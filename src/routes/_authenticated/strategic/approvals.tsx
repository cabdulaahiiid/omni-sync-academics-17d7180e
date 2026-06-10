import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listApprovalQueue, decideApproval } from "@/lib/ma.functions";
import { maRejectSemesterWithFeedback } from "@/lib/feedback.functions";
import {
  listDeptsWithPendingSessions,
  listPendingWeeksForDept,
  getWeekTimetable,
  decideWeek,
  splitSemesterToWeeks,
} from "@/lib/approvals.functions";
import { FeedbackChat } from "@/components/feedback-chat";
import { ApprovalActions } from "@/components/erp/approval-actions";
import { RejectFeedbackDialog } from "@/components/erp/reject-feedback-dialog";
import { ConflictBadges } from "@/components/erp/conflict-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Check, MessageSquareWarning, Split, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [tab, setTab] = useState<"session" | "semester">("session");
  const [decisionFilter, setDecisionFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");
  const [conflictFilter, setConflictFilter] = useState<"any" | "trainer" | "venue" | "qualification" | "load">("any");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const list = useServerFn(listApprovalQueue);
  const rejectSemFn = useServerFn(maRejectSemesterWithFeedback);
  const splitFn = useServerFn(splitSemesterToWeeks);
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("ma-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue" },
        () => {
          qc.invalidateQueries({ queryKey: ["approval-queue"] });
          qc.invalidateQueries({ queryKey: ["approvals-depts"] });
          qc.invalidateQueries({ queryKey: ["approvals-weeks"] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "semester_registry" },
        () => qc.invalidateQueries({ queryKey: ["approval-queue"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const [chatSemesterId, setChatSemesterId] = useState<string | null>(null);
  const { data: semData, isLoading: semLoading } = useQuery({
    queryKey: ["approval-queue", "semester", decisionFilter],
    queryFn: () => list({ data: { type: "semester", decision: decisionFilter } }),
    enabled: tab === "semester",
  });
  const decide = useServerFn(decideApproval);
  const decideSemMut = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected"; comment: string }) =>
      decide({ data: vars }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approval-queue"] }); toast.success("Decision recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectSem = useMutation({
    mutationFn: (vars: { semester_id: string; message: string }) =>
      rejectSemFn({ data: vars }),
    onSuccess: () => {
      toast.success("Semester returned to DH with feedback");
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const splitMut = useMutation({
    mutationFn: (approval_id: string) => splitFn({ data: { approval_id } }),
    onSuccess: (r) => {
      toast.success(`Split into ${r.created} weekly session approval(s)`);
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      qc.invalidateQueries({ queryKey: ["approvals-depts"] });
      qc.invalidateQueries({ queryKey: ["approvals-weeks"] });
      setTab("session");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Client-side filter/sort/paginate semester rows
  const filteredSem = (() => {
    const q = search.trim().toLowerCase();
    let rows = (semData ?? []) as any[];
    if (q) {
      rows = rows.filter((r) => {
        const name = (r.semester?.name ?? "").toLowerCase();
        return name.includes(q);
      });
    }
    if (conflictFilter !== "any") {
      rows = rows.filter((r) =>
        conflictFilter === "trainer" ? r.conflict_trainer :
        conflictFilter === "venue" ? r.conflict_venue :
        conflictFilter === "qualification" ? r.invalid_qualification :
        conflictFilter === "load" ? r.excessive_load : true,
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sortBy === "name") {
        return (a.semester?.name ?? "").localeCompare(b.semester?.name ?? "");
      }
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortBy === "newest" ? db - da : da - db;
    });
    return rows;
  })();
  const total = filteredSem.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredSem.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setPage(1); }, [search, conflictFilter, sortBy, pageSize, decisionFilter]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Approval Queue</h1>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search semester or module…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={conflictFilter} onValueChange={(v) => setConflictFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Any conflict" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any conflict</SelectItem>
              <SelectItem value="trainer">Trainer conflict</SelectItem>
              <SelectItem value="venue">Venue conflict</SelectItem>
              <SelectItem value="qualification">Qualification</SelectItem>
              <SelectItem value="load">Excessive load</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name">Name (A→Z)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "session" | "semester")}>
        <TabsList>
          <TabsTrigger value="session">Sessions</TabsTrigger>
          <TabsTrigger value="semester">Semesters</TabsTrigger>
        </TabsList>
        <TabsContent value="session" className="mt-4">
          <SessionApprovalsByDeptWeek />
        </TabsContent>
        <TabsContent value="semester" className="space-y-3 mt-4">
          {semLoading && <p className="text-muted-foreground">Loading…</p>}
          {!semLoading && total === 0 && (
            <p className="text-muted-foreground">No {decisionFilter} semester requests.</p>
          )}
          {!semLoading && total > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
            </p>
          )}
          {pageRows.map((row: any) => (
            <ApprovalRow
              key={row.id}
              row={row}
              onApprove={(comment) => decideSemMut.mutate({ id: row.id, decision: "approved", comment })}
              onReject={(message) => rejectSem.mutate({ semester_id: row.target_id, message })}
              rejecting={rejectSem.isPending}
              onOpenChat={() => setChatSemesterId(row.target_id)}
              onSplit={() => splitMut.mutate(row.id)}
              splitting={splitMut.isPending}
            />
          ))}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {currentPage} of {pageCount}</span>
              <Button size="sm" variant="outline" disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {chatSemesterId && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg">
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setChatSemesterId(null)}>Close</Button>
            </div>
            <FeedbackChat semesterId={chatSemesterId} title="Conversation with Department Head" />
          </div>
        </div>
      )}

    </div>
  );
}

function ApprovalRow({ row, onApprove, onReject, rejecting, onOpenChat, onSplit, splitting }: { row: any; onApprove: (comment: string) => void; onReject: (message: string) => void; rejecting?: boolean; onOpenChat?: () => void; onSplit?: () => void; splitting?: boolean }) {
  const [comment, setComment] = useState("");
  const [showWeekly, setShowWeekly] = useState(false);
  const [deptId, setDeptId] = useState<string | null>(null);
  useEffect(() => {
    if (row.type !== "semester" || deptId) return;
    let cancelled = false;
    supabase
      .from("schedules")
      .select("department_id")
      .eq("semester_id", row.target_id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data?.department_id) setDeptId(data.department_id); });
    return () => { cancelled = true; };
  }, [row.type, row.target_id, deptId]);
  const target = row.schedule ?? row.semester;
  const entityName = row.type === "session"
    ? `${target?.module_code ?? "?"} • ${target?.module_name ?? ""}`
    : target?.name ?? "Semester";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {entityName}
        </CardTitle>
        <ConflictBadges
          trainer={row.conflict_trainer}
          venue={row.conflict_venue}
          qualification={row.invalid_qualification}
          load={row.excessive_load}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {row.type === "session" && target && (
          <p className="text-sm text-muted-foreground">
            {target.date} • {target.start_time}-{target.end_time} • {target.trainer_name}
          </p>
        )}
        {row.type === "semester" && target && (
          <p className="text-sm text-muted-foreground">
            {target.start_date} → {target.end_date}
          </p>
        )}
        <Textarea placeholder="Decision comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
        <ApprovalActions
          approveLabel={row.type === "semester" ? "Approve Full Semester" : "Approve"}
          entityName={entityName}
          rejectTitle={row.type === "semester" ? `Reject semester: ${entityName}` : `Reject: ${entityName}`}
          rejectDescription={
            row.type === "semester"
              ? "The DH will receive your feedback and the timetable will unlock for edits. A chat thread opens for follow-up."
              : undefined
          }
          isPending={rejecting}
          onApprove={() => onApprove(comment)}
          onReject={(msg) => onReject(msg)}
          extraActions={
            <>
              {onOpenChat && <Button variant="outline" onClick={onOpenChat}>Open chat</Button>}
              {row.type === "semester" && onSplit && (
                <Button variant="secondary" onClick={onSplit} disabled={splitting}>
                  <Split className="mr-1 h-3 w-3" /> {splitting ? "Splitting…" : "Approve by Week (split)"}
                </Button>
              )}
              {row.type === "semester" && (
                <Button variant="outline" onClick={() => setShowWeekly((v) => !v)} disabled={!deptId}>
                  {showWeekly ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
                  {showWeekly ? "Hide Weekly Timetable" : "View Weekly Timetable"}
                </Button>
              )}
            </>
          }
        />
        {row.type === "semester" && showWeekly && deptId && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <SessionApprovalsByDeptWeek fixedDeptId={deptId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionApprovalsByDeptWeek({ fixedDeptId }: { fixedDeptId?: string } = {}) {
  const qc = useQueryClient();
  const listDeptsFn = useServerFn(listDeptsWithPendingSessions);
  const listWeeksFn = useServerFn(listPendingWeeksForDept);
  const getWeekFn = useServerFn(getWeekTimetable);
  const decideWeekFn = useServerFn(decideWeek);

  const [storedDeptId, setStoredDeptId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("approvals.deptId") : null,
  );
  const deptId = fixedDeptId ?? storedDeptId;
  const setDeptId = (v: string | null) => {
    if (!fixedDeptId) setStoredDeptId(v);
  };
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    week: number; decision: "approved" | "rejected";
  } | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!fixedDeptId && storedDeptId) localStorage.setItem("approvals.deptId", storedDeptId);
  }, [fixedDeptId, storedDeptId]);

  const { data: depts, isLoading: deptsLoading } = useQuery({
    queryKey: ["approvals-depts"],
    queryFn: () => listDeptsFn(),
    enabled: !fixedDeptId,
  });
  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["approvals-weeks", deptId],
    queryFn: () => listWeeksFn({ data: { department_id: deptId! } }),
    enabled: !!deptId,
  });
  const { data: weekRows, isLoading: weekLoading } = useQuery({
    queryKey: ["approvals-week", deptId, viewWeek],
    queryFn: () => getWeekFn({ data: { department_id: deptId!, week_num: viewWeek! } }),
    enabled: !!deptId && viewWeek != null,
  });

  const decideMut = useMutation({
    mutationFn: () =>
      decideWeekFn({
        data: {
          department_id: deptId!,
          week_num: pendingDecision!.week,
          decision: pendingDecision!.decision,
          comment: comment.trim(),
        },
      }),
    onSuccess: (r) => {
      toast.success(`${pendingDecision!.decision === "approved" ? "Approved" : "Sent back"} ${r.count} session(s)`);
      qc.invalidateQueries({ queryKey: ["approvals-weeks", deptId] });
      qc.invalidateQueries({ queryKey: ["approvals-depts"] });
      qc.invalidateQueries({ queryKey: ["approvals-week", deptId, pendingDecision!.week] });
      setPendingDecision(null);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!fixedDeptId && <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filter by Department</CardTitle>
        </CardHeader>
        <CardContent>
          {deptsLoading && <p className="text-sm text-muted-foreground">Loading departments…</p>}
          {!deptsLoading && (
            <Select value={deptId ?? ""} onValueChange={(v) => { setDeptId(v); setViewWeek(null); }}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a department…" />
              </SelectTrigger>
              <SelectContent>
                {(depts ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} {d.pending_count > 0 && <span className="ml-2 text-xs text-muted-foreground">({d.pending_count} pending)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>}

      {!deptId && !fixedDeptId && (
        <p className="text-sm text-muted-foreground">Select a department to view weekly schedules.</p>
      )}

      {deptId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {weeksLoading && <p className="text-sm text-muted-foreground">Loading weeks…</p>}
            {!weeksLoading && (weeks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No sessions found for this department.</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {(weeks ?? []).map((w: any) => (
                <Card key={w.week_num} className="border">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Week {w.week_num}</span>
                      {w.pending > 0 ? (
                        <Badge variant="destructive">{w.pending} pending</Badge>
                      ) : (
                        <Badge variant="secondary">cleared</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{w.total} session(s) total</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setViewWeek(w.week_num)}>
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Button>
                      <Button size="sm" disabled={w.pending === 0}
                        onClick={() => { setComment(""); setPendingDecision({ week: w.week_num, decision: "approved" }); }}>
                        <Check className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" disabled={w.pending === 0}
                        onClick={() => { setComment(""); setPendingDecision({ week: w.week_num, decision: "rejected" }); }}>
                        <MessageSquareWarning className="mr-1 h-3 w-3" /> Send back
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View week dialog */}
      <Dialog open={viewWeek != null} onOpenChange={(o) => !o && setViewWeek(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Week {viewWeek} timetable</DialogTitle></DialogHeader>
          {weekLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!weekLoading && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(weekRows ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.start_time}–{r.end_time}</TableCell>
                      <TableCell><span className="font-mono text-xs">{r.module_code}</span> · {r.module_name}</TableCell>
                      <TableCell>{r.trainer_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell>
                        {r.approval ? (
                          <Badge variant={r.approval.decision === "pending" ? "destructive" : "secondary"}>
                            {r.approval.decision}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(weekRows ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sessions.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decide-week dialog */}
      <Dialog open={!!pendingDecision} onOpenChange={(o) => { if (!o) { setPendingDecision(null); setComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDecision?.decision === "approved" ? "Approve" : "Send back"} Week {pendingDecision?.week}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will {pendingDecision?.decision === "approved" ? "approve" : "return"} all pending sessions in this week.
          </p>
          <Textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={pendingDecision?.decision === "rejected" ? "Required: what needs to change?" : "Optional comment"}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingDecision(null); setComment(""); }}>Cancel</Button>
            <Button
              variant={pendingDecision?.decision === "approved" ? "default" : "destructive"}
              disabled={
                decideMut.isPending ||
                (pendingDecision?.decision === "rejected" && comment.trim().length < 3)
              }
              onClick={() => decideMut.mutate()}
            >
              {decideMut.isPending ? "Submitting…" : pendingDecision?.decision === "approved" ? "Approve all" : "Send back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
