import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listApprovalQueue, decideApproval } from "@/lib/ma.functions";
import { maRejectSemesterWithFeedback } from "@/lib/feedback.functions";
import {
  listDeptsWithPendingSessions,
  listAllWeeksForDept,
  getWeekTimetable,
  decideWeek,
  splitSemesterToWeeks,
} from "@/lib/approvals.functions";
import { listSemesters } from "@/lib/ma.functions";
import { FeedbackChat } from "@/components/feedback-chat";
import { ApprovalChatDock } from "@/components/approval-chat-dock";
import { ApprovalVersionTimeline } from "@/components/approval-version-timeline";
import { ApprovalActions } from "@/components/erp/approval-actions";
import { ConflictBadges } from "@/components/erp/conflict-badges";
import { EmptyState } from "@/components/erp/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Check, MessageSquareWarning, Split, ChevronDown, ChevronUp, Search, X, Inbox } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    <div className="container mx-auto space-y-4 p-6">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-1 border-b border-border/70 bg-background/85 px-6 py-3 backdrop-blur">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Approvals — Weekly Status</h1>
        <p className="text-xs text-muted-foreground">Approve, return, or split semester &amp; per-week submissions.</p>
      </div>
      <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
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
          <SessionApprovalsByDeptWeek onSwitchTab={() => setTab("semester")} />
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
        <ApprovalChatDock
          semesterId={chatSemesterId}
          weekNum={null}
          title="Discussion with DH"
          open={true}
          onOpenChange={(o) => !o && setChatSemesterId(null)}
        />
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
        {row.type === "semester" && (
          <div className="mt-3 rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version history</p>
            <ApprovalVersionTimeline semesterId={row.target_id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionApprovalsByDeptWeek({ fixedDeptId, onSwitchTab }: { fixedDeptId?: string; onSwitchTab?: () => void } = {}) {
  const qc = useQueryClient();
  const listDeptsFn = useServerFn(listDeptsWithPendingSessions);
  const listWeeksFn = useServerFn(listAllWeeksForDept);
  const listSemestersFn = useServerFn(listSemesters);
  const getWeekFn = useServerFn(getWeekTimetable);
  const decideWeekFn = useServerFn(decideWeek);

  const [storedDeptId, setStoredDeptId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("approvals.deptId") : null,
  );
  const deptId = fixedDeptId ?? storedDeptId;
  const setDeptId = (v: string | null) => {
    if (!fixedDeptId) setStoredDeptId(v);
  };
  const [storedSemesterId, setStoredSemesterId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("approvals.semesterId") : null,
  );
  const semesterId = storedSemesterId;
  const [tablePage, setTablePage] = useState(1);
  const PAGE_SIZE = 10;
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [pendingDecision, setPendingDecision] = useState<{
    week: number; decision: "approved" | "rejected";
  } | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!fixedDeptId && storedDeptId) localStorage.setItem("approvals.deptId", storedDeptId);
  }, [fixedDeptId, storedDeptId]);
  useEffect(() => {
    if (storedSemesterId) localStorage.setItem("approvals.semesterId", storedSemesterId);
  }, [storedSemesterId]);
  useEffect(() => { setTablePage(1); }, [deptId, semesterId]);

  const { data: depts, isLoading: deptsLoading } = useQuery({
    queryKey: ["approvals-depts"],
    queryFn: () => listDeptsFn(),
    enabled: !fixedDeptId,
  });
  const { data: semesters } = useQuery({
    queryKey: ["approvals-semesters"],
    queryFn: () => listSemestersFn(),
    enabled: !fixedDeptId,
  });
  useEffect(() => {
    if (!storedSemesterId && (semesters ?? []).length > 0) {
      setStoredSemesterId((semesters as any[])[0].id);
    }
  }, [semesters, storedSemesterId]);
  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["approvals-weeks", deptId, semesterId],
    queryFn: () => listWeeksFn({ data: { department_id: deptId!, semester_id: semesterId ?? undefined } }),
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
      {!fixedDeptId && (
        <Card className="rounded-2xl">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Filter by Academic Session</label>
              <Select value={semesterId ?? ""} onValueChange={(v) => { setStoredSemesterId(v); setViewWeek(null); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a semester…" /></SelectTrigger>
                <SelectContent>
                  {(semesters ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Filter by Department</label>
              {deptsLoading ? (
                <p className="text-sm text-muted-foreground">Loading departments…</p>
              ) : (
                <Select value={deptId ?? ""} onValueChange={(v) => { setDeptId(v); setViewWeek(null); }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose a department…" /></SelectTrigger>
                  <SelectContent>
                    {(depts ?? []).map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}{d.pending_count > 0 ? ` (${d.pending_count} pending)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!deptId && !fixedDeptId && (
        <p className="text-sm text-muted-foreground">Select a department to view weekly schedules.</p>
      )}

      {deptId && (
        <WeeklyStatusTable
          weeks={weeks ?? []}
          loading={weeksLoading}
          page={tablePage}
          pageSize={PAGE_SIZE}
          onPageChange={setTablePage}
          onSwitchTab={onSwitchTab}
          onView={(w) => setViewWeek(w)}
          onApprove={(w) => { setComment(""); setPendingDecision({ week: w, decision: "approved" }); }}
          onSendBack={(w) => { setComment(""); setPendingDecision({ week: w, decision: "rejected" }); }}
        />
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

type WeekRow = {
  week_num: number;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  draft: number;
  start_date: string | null;
  end_date: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function weekStatus(w: WeekRow): "approved" | "pending" | "draft" | "rejected" {
  if (w.rejected > 0) return "rejected";
  if (w.pending > 0) return "pending";
  if (w.total > 0 && w.approved === w.total) return "approved";
  return "draft";
}

function StatusPill({ status }: { status: ReturnType<typeof weekStatus> }) {
  const map = {
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    pending: { label: "Pending Master", cls: "bg-amber-100 text-amber-900 border-amber-200" },
    draft: { label: "Draft (Trainer)", cls: "bg-muted text-muted-foreground border-border" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 border-red-200" },
  } as const;
  const m = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function WeeklyStatusTable({
  weeks, loading, page, pageSize, onPageChange, onView, onApprove, onSendBack, onSwitchTab,
}: {
  weeks: WeekRow[];
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onView: (week: number) => void;
  onApprove: (week: number) => void;
  onSendBack: (week: number) => void;
  onSwitchTab?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = weeks.find((w) => w.start_date && w.end_date && w.start_date <= today && today <= w.end_date)?.week_num;
  const total = weeks.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const rows = weeks.slice((current - 1) * pageSize, current * pageSize);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Approvals — Weekly Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 sm:p-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[160px]">Week</TableHead>
                <TableHead className="w-[180px]">Dates</TableHead>
                <TableHead className="w-[140px]">Sessions Total</TableHead>
                <TableHead className="w-[180px]">Approval Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading weeks…</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8">
                    <EmptyState
                      icon={Inbox}
                      title="No weeks to show"
                      description="Once the Department Head uploads a semester and submits weeks for review, they appear here."
                      action={onSwitchTab && (
                        <Button size="sm" variant="outline" onClick={onSwitchTab}>Open Semesters tab</Button>
                      )}
                    />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((w) => {
                const status = weekStatus(w);
                const isCurrent = w.week_num === currentWeek;
                return (
                  <TableRow key={w.week_num} className="hover:bg-accent/30">
                    <TableCell className="font-medium">
                      Week {w.week_num}
                      {isCurrent && <span className="ml-2 text-xs text-primary">(Current)</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(w.start_date)} – {fmtDate(w.end_date)}
                    </TableCell>
                    <TableCell className="text-sm">{w.total}</TableCell>
                    <TableCell><StatusPill status={status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => onView(w.week_num)}>
                          <Eye className="mr-1 h-3 w-3" /> View Details
                        </Button>
                        <TooltipProvider>
                          {status === "pending" && (
                            <>
                              <Button size="sm" variant="destructive" onClick={() => onSendBack(w.week_num)}>
                                <MessageSquareWarning className="mr-1 h-3 w-3" /> Send Back
                              </Button>
                              <Button size="sm" onClick={() => onApprove(w.week_num)}>
                                <Check className="mr-1 h-3 w-3" /> Approve Week
                              </Button>
                            </>
                          )}
                          {status === "draft" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button size="sm" disabled>Awaiting DH</Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Department Head hasn't submitted this week yet.</TooltipContent>
                            </Tooltip>
                          )}
                          {status === "approved" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button size="sm" variant="outline" disabled>Un-Approve</Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Sessions are already live — contact admin to revoke.</TooltipContent>
                            </Tooltip>
                          )}
                          {status === "rejected" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button size="sm" variant="outline" disabled>Awaiting Resubmit</Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Returned to Department Head for changes.</TooltipContent>
                            </Tooltip>
                          )}
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>Previous</Button>
            <span className="text-xs text-muted-foreground">Page {current} of {pageCount}</span>
            <Button size="sm" variant="outline" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>Next</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
