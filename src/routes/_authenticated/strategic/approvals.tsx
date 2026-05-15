import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listApprovalQueue, decideApproval } from "@/lib/ma.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [tab, setTab] = useState<"session" | "semester">("session");
  const list = useServerFn(listApprovalQueue);
  const decide = useServerFn(decideApproval);
  const qc = useQueryClient();
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
            <ApprovalRow key={row.id} row={row} onDecide={(decision, comment) => m.mutate({ id: row.id, decision, comment })} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApprovalRow({ row, onDecide }: { row: any; onDecide: (d: "approved" | "rejected", c: string) => void }) {
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
        </div>
      </CardContent>
    </Card>
  );
}
