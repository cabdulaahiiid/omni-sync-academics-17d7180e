import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listApprovalQueue, decideApproval } from "@/lib/ma.functions";
import { maRejectSemesterWithFeedback } from "@/lib/feedback.functions";
import { FeedbackChat } from "@/components/feedback-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [tab, setTab] = useState<"session" | "semester">("session");
  const list = useServerFn(listApprovalQueue);
  const decide = useServerFn(decideApproval);
  const rejectSemFn = useServerFn(maRejectSemesterWithFeedback);
  const qc = useQueryClient();
  const [chatSemesterId, setChatSemesterId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; semester_id: string; name: string } | null>(null);
  const [rejectMessage, setRejectMessage] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["approval-queue", tab],
    queryFn: () => list({ data: { type: tab, decision: "pending" } }),
  });
  const m = useMutation({
    mutationFn: (vars: { id: string; decision: "approved" | "rejected"; comment: string }) =>
      decide({ data: vars }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approval-queue"] }); toast.success("Decision recorded"); },
    onError: (e: any) => toast.error(e.message),
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

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Approval Queue</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="session">Sessions</TabsTrigger>
          <TabsTrigger value="semester">Semesters</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-4">
          {isLoading && <p className="text-muted-foreground">Loading…</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="text-muted-foreground">No pending {tab} requests.</p>
          )}
          {(data ?? []).map((row: any) => (
            <ApprovalRow
              key={row.id}
              row={row}
              onDecide={(decision, comment) => {
                if (row.type === "semester" && decision === "rejected") {
                  setRejectTarget({ id: row.id, semester_id: row.target_id, name: row.semester?.name ?? "Semester" });
                  setRejectMessage(comment);
                  return;
                }
                m.mutate({ id: row.id, decision, comment });
              }}
              onOpenChat={row.type === "semester" ? () => setChatSemesterId(row.target_id) : undefined}
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

function ApprovalRow({ row, onDecide, onOpenChat }: { row: any; onDecide: (d: "approved" | "rejected", c: string) => void; onOpenChat?: () => void }) {
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
        </div>
      </CardContent>
    </Card>
  );
}
