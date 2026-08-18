import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCtWorkflowQueue, pdDecideRequest, pdReturnBatchToIps, pdStartReview,
} from "@/lib/ct/workflow.functions";
import { toastError } from "@/lib/errors/toast";
import { StatusBadge } from "@/components/erp/status-badge";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DELEGATED = ["DELEGATED_TO_PD", "PD_REVIEW"];

function ProgramDirectorPage() {
  const queueFn = useServerFn(listCtWorkflowQueue);
  const startFn = useServerFn(pdStartReview);
  const decideFn = useServerFn(pdDecideRequest);
  const returnFn = useServerFn(pdReturnBatchToIps);

  const queue = useQuery({ queryKey: ["ct", "workflow", "pd"], queryFn: () => queueFn(), staleTime: 5_000 });
  const [comments, setComments] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [batchNote, setBatchNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      await queue.refetch();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }

  const requests = ((queue.data?.requests ?? []) as any[]).filter((r) => DELEGATED.includes(r.status) || r.status === "PD_APPROVED");
  const deptName = (id: string) => (queue.data?.departments ?? []).find((d: any) => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delegated requests</CardTitle>
          <p className="text-xs text-muted-foreground">
            You only see requests the Industrial Practical Supervisor delegated to you. Your approval returns the request to the supervisor for final processing.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading delegated requests…</p>
          ) : requests.length === 0 ? (
            <EmptyState title="No delegated requests" description="Requests appear here once the supervisor delegates them to you." />
          ) : (
            requests.map((r) => {
              const members = (queue.data?.members ?? []).filter((m: any) => m.request_id === r.id);
              const comment = comments[r.id] ?? "";
              const actionable = DELEGATED.includes(r.status);
              return (
                <div key={r.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      {actionable && (
                        <Checkbox
                          checked={selected.includes(r.id)}
                          onCheckedChange={(c) =>
                            setSelected((prev) => (c ? [...prev, r.id] : prev.filter((x) => x !== r.id)))
                          }
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{r.reference} · {r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {deptName(r.department_id)} · {r.requested_start_date} → {r.requested_end_date} · {members.length} trainee(s)
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {r.manual_initiation && (
                    <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {r.initiation_note ?? "MANUALLY INITIATED — THEORY < 80%"}
                    </p>
                  )}

                  {members.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {members.map((m: any) => (
                        <li key={m.student_id} className="flex items-center gap-2">
                          <span>{m.students?.full_name} ({m.students?.registration_number})</span>
                          <Badge variant={m.manual_override ? "outline" : "secondary"}>
                            {m.theory_percent === null ? "No theory record" : `${m.theory_percent}% theory`}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}

                  {actionable && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Comment (required for reject or return)"
                        value={comment}
                        onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        {r.status === "DELEGATED_TO_PD" && (
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => run(() => startFn({ data: { request_id: r.id, expected_version: r.version ?? null } }), "Marked as under review.")}>
                            Start review
                          </Button>
                        )}
                        <Button size="sm" disabled={busy}
                          onClick={() => run(() => decideFn({ data: { request_id: r.id, decision: "APPROVE", comment: comment || null, expected_version: r.version ?? null } }), "Recommended for supervisor final approval.")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy}
                          onClick={() => run(() => decideFn({ data: { request_id: r.id, decision: "REJECT", comment, expected_version: r.version ?? null } }), "Request rejected.")}>
                          Reject
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={() => run(() => decideFn({ data: { request_id: r.id, decision: "RETURN", comment, expected_version: r.version ?? null } }), "Returned for correction.")}>
                          Return for correction
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {selected.length > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs font-medium">Return {selected.length} selected request(s) to the supervisor</p>
              <Textarea rows={2} placeholder="Explain what the supervisor should look at" value={batchNote} onChange={(e) => setBatchNote(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy || batchNote.trim().length < 3}
                onClick={() => run(async () => {
                  const versions: Record<string, number> = {};
                  for (const id of selected) {
                    const req = ((queue.data?.requests ?? []) as any[]).find((x) => x.id === id);
                    if (typeof req?.version === "number") versions[id] = req.version;
                  }
                  const res = await returnFn({ data: { request_ids: selected, note: batchNote.trim(), expected_versions: versions } });
                  setSelected([]); setBatchNote("");
                  if (res.skipped > 0) {
                    toast.warning(`${res.processed} returned, ${res.skipped} skipped because they had already changed.`);
                  }
                }, "Returned to the supervisor.")}>
                Return to supervisor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/program-director")({
  head: () => ({
    meta: [
      { title: "Program Director Review | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Program Director workspace for practical training requests delegated by the Industrial Practical Supervisor." },
      { property: "og:title", content: "Program Director Review" },
      { property: "og:description", content: "Review delegated industrial practical training requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgramDirectorPage,
});
