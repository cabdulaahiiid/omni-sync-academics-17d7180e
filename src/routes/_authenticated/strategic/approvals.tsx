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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Check, MessageSquareWarning, Split, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [tab, setTab] = useState<"session" | "semester">("session");
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
  const [rejectTarget, setRejectTarget] = useState<{ id: string; semester_id: string; name: string } | null>(null);
  const [rejectMessage, setRejectMessage] = useState("");
  const { data: semData, isLoading: semLoading } = useQuery({
    queryKey: ["approval-queue", "semester"],
    queryFn: () => list({ data: { type: "semester", decision: "pending" } }),
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
    mutationFn: () => rejectSemFn({ data: { semester_id: rejectTarget!.semester_id, message: rejectMessage.trim() } }),
    onSuccess: () => {
      toast.success("Semester returned to DH with feedback");
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      setRejectTarget(null);
      setRejectMessage("");
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

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Approval Queue</h1>
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
          {!semLoading && (semData ?? []).length === 0 && (
            <p className="text-muted-foreground">No pending semester requests.</p>
          )}
          {(semData ?? []).map((row: any) => (
            <ApprovalRow
              key={row.id}
              row={row}
              onDecide={(decision, comment) => {
                if (decision === "rejected") {
                  setRejectTarget({ id: row.id, semester_id: row.target_id, name: row.semester?.name ?? "Semester" });
                  setRejectMessage(comment);
                  return;
                }
                decideSemMut.mutate({ id: row.id, decision, comment });
              }}
              onOpenChat={() => setChatSemesterId(row.target_id)}
              onSplit={() => splitMut.mutate(row.id)}
              splitting={splitMut.isPending}
            />
          ))}
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

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectMessage(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject semester: {rejectTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The DH will receive your feedback and the timetable will unlock for edits. A chat thread opens for follow-up.
            </p>
            <Textarea rows={5} value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)}
              placeholder="Required feedback message (what needs to change?)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={rejectMessage.trim().length < 3 || rejectSem.isPending}
              onClick={() => rejectSem.mutate()}>
              {rejectSem.isPending ? "Sending…" : "Send feedback & reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovalRow({ row, onDecide, onOpenChat, onSplit, splitting }: { row: any; onDecide: (d: "approved" | "rejected", c: string) => void; onOpenChat?: () => void; onSplit?: () => void; splitting?: boolean }) {
  const [comment, setComment] = useState("");
  const target = row.schedule ?? row.semester;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {row.type === "session"
            ? `${target?.module_code ?? "?"} • ${target?.module_name ?? ""}`
            : target?.name ?? "Semester"}
        </CardTitle>
        <div className="flex gap-2">
          {row.conflict_trainer && <Badge variant="destructive">Trainer conflict</Badge>}
          {row.conflict_venue && <Badge variant="destructive">Venue conflict</Badge>}
          {row.invalid_qualification && <Badge variant="destructive">Qualification</Badge>}
          {row.excessive_load && <Badge variant="destructive">Load</Badge>}
        </div>
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
        <div className="flex gap-2">
          <Button onClick={() => onDecide("approved", comment)}>Approve</Button>
          <Button variant="destructive" onClick={() => onDecide("rejected", comment)}>Reject</Button>
          {onOpenChat && <Button variant="outline" onClick={onOpenChat}>Open chat</Button>}
          {row.type === "semester" && onSplit && (
            <Button variant="secondary" onClick={onSplit} disabled={splitting}>
              <Split className="mr-1 h-3 w-3" /> {splitting ? "Splitting…" : "Split into weeks"}
            </Button>
          )}
        </div>
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
