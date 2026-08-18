import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ipsDecideRequest, ipsDelegateToPd, ipsStartReview,
  ipsHoldRequest, ipsModifyRequest,
  listCtWorkflowQueue, listProgramDirectors,
} from "@/lib/ct/workflow.functions";
import { toastError } from "@/lib/errors/toast";
import { StatusBadge } from "@/components/erp/status-badge";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ACTIONABLE = ["PENDING_APPROVAL", "UNDER_IPS_REVIEW", "PD_APPROVED", "IPS_FINAL_APPROVAL", "ON_HOLD", "MODIFIED"];
const DECIDABLE = ["PENDING_APPROVAL", "UNDER_IPS_REVIEW", "PD_APPROVED", "IPS_FINAL_APPROVAL"];

function SupervisorPage() {
  const queueFn = useServerFn(listCtWorkflowQueue);
  const pdFn = useServerFn(listProgramDirectors);
  const startFn = useServerFn(ipsStartReview);
  const decideFn = useServerFn(ipsDecideRequest);
  const delegateFn = useServerFn(ipsDelegateToPd);
  const holdFn = useServerFn(ipsHoldRequest);
  const modifyFn = useServerFn(ipsModifyRequest);

  const queue = useQuery({ queryKey: ["ct", "workflow", "ips"], queryFn: () => queueFn(), staleTime: 5_000 });
  const directors = useQuery({ queryKey: ["ct", "program-directors"], queryFn: () => pdFn(), staleTime: 60_000 });
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [modifying, setModifying] = useState<string | null>(null);
  const [modifyForm, setModifyForm] = useState<{ start_date: string; end_date: string }>({ start_date: "", end_date: "" });

  async function run(id: string, fn: () => Promise<unknown>, message: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(message);
      await queue.refetch();
    } catch (e) { toastError(e); } finally { setBusy(null); }
  }

  const requests = (queue.data?.requests ?? []) as any[];
  const deptName = (id: string) =>
    (queue.data?.departments ?? []).find((d: any) => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Supervisor decision queue</CardTitle>
          <p className="text-xs text-muted-foreground">
            You are the primary authority for practical training requests. Approve, reject, return for correction, or delegate to a Program Director.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading requests…</p>
          ) : requests.length === 0 ? (
            <EmptyState title="Nothing waiting" description="Requests submitted by the Industrial Department Head appear here." />
          ) : (
            requests.map((r) => {
              const members = (queue.data?.members ?? []).filter((m: any) => m.request_id === r.id);
              const overrides = members.filter((m: any) => m.manual_override);
              const history = (queue.data?.decisions ?? []).filter((d: any) => d.request_id === r.id);
              const canDecide = ACTIONABLE.includes(r.status);
              const canDecideNow = DECIDABLE.includes(r.status);
              const comment = comments[r.id] ?? "";
              return (
                <div key={r.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{r.reference} · {r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {deptName(r.department_id)} · {r.requested_start_date} → {r.requested_end_date} · {members.length} trainee(s)
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {r.manual_initiation && (
                    <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {r.initiation_note ?? "MANUALLY INITIATED — THEORY < 80%"} · {overrides.length} trainee(s) below the theory threshold
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

                  {canDecide && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Comment (required for reject or return)"
                        value={comment}
                        onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === "PENDING_APPROVAL" && (
                          <Button size="sm" variant="outline" disabled={busy === r.id}
                            onClick={() => run(r.id, () => startFn({ data: { request_id: r.id, expected_version: r.version ?? null } }), "Marked as under review.")}>
                            Start review
                          </Button>
                        )}
                        <Button size="sm" disabled={busy === r.id || !canDecideNow}
                          onClick={() => run(r.id, () => decideFn({ data: { request_id: r.id, decision: "APPROVE", comment: comment || null, expected_version: r.version ?? null } }), "Request approved.")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy === r.id || !canDecideNow}
                          onClick={() => run(r.id, () => decideFn({ data: { request_id: r.id, decision: "REJECT", comment, expected_version: r.version ?? null } }), "Request rejected.")}>
                          Reject
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id || !canDecideNow}
                          onClick={() => run(r.id, () => decideFn({ data: { request_id: r.id, decision: "RETURN", comment, expected_version: r.version ?? null } }), "Returned for correction.")}>
                          Return for correction
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id}
                          onClick={() => {
                            if (comment.trim().length < 5) {
                              toast.error("Give a reason before holding", { description: "Type at least a short explanation in the comment box — the Department Head is notified with it." });
                              return;
                            }
                            run(r.id, () => holdFn({ data: { request_id: r.id, hold_reason: comment, expected_version: r.version ?? null } }), "Request placed on hold.");
                          }}>
                          Hold
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id}
                          onClick={() => {
                            setModifying(modifying === r.id ? null : r.id);
                            setModifyForm({ start_date: r.requested_start_date ?? "", end_date: r.requested_end_date ?? "" });
                          }}>
                          Modify
                        </Button>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          defaultValue=""
                          onChange={(e) => {
                            const to = e.target.value;
                            e.target.value = "";
                            if (to) run(r.id, () => delegateFn({ data: { request_id: r.id, to_user_id: to, note: comment || null, expected_version: r.version ?? null } }), "Delegated to the Program Director.");
                          }}
                        >
                          <option value="">Delegate to Program Director…</option>
                          {(directors.data ?? []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                          ))}
                        </select>
                      </div>
                      {modifying === r.id && (
                        <div className="grid gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                          <div className="space-y-1.5">
                            <Label htmlFor={`start-${r.id}`}>Start date</Label>
                            <Input id={`start-${r.id}`} type="date" value={modifyForm.start_date}
                              onChange={(e) => setModifyForm((f) => ({ ...f, start_date: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`end-${r.id}`}>End date</Label>
                            <Input id={`end-${r.id}`} type="date" value={modifyForm.end_date}
                              onChange={(e) => setModifyForm((f) => ({ ...f, end_date: e.target.value }))} />
                          </div>
                          <Button size="sm" disabled={busy === r.id}
                            onClick={() => {
                              setModifying(null);
                              run(r.id, () => modifyFn({
                                data: {
                                  request_id: r.id,
                                  start_date: modifyForm.start_date || null,
                                  end_date: modifyForm.end_date || null,
                                  note: comment || null,
                                  expected_version: r.version ?? null,
                                },
                              }), "Request updated — the Department Head is notified.");
                            }}>
                            Save changes
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {history.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Decision history ({history.length})</summary>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {history.map((h: any) => (
                          <li key={h.id}>
                            {new Date(h.created_at).toLocaleString()} · {h.action} · {h.actor_role ?? "—"}
                            {h.comment ? ` · ${h.comment}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/supervisor")({
  head: () => ({
    meta: [
      { title: "Practical Training Supervisor Queue | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Industrial Practical Supervisor workspace: approve, reject, return or delegate practical training requests." },
      { property: "og:title", content: "Practical Training Supervisor Queue" },
      { property: "og:description", content: "Approve, reject, return or delegate industrial practical training requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisorPage,
});
