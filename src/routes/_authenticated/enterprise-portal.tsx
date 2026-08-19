import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listEnterprisePracticalWork,
  confirmPracticalTask,
  decidePracticalTask,
  correctPracticalTask,
} from "@/lib/ct/practical-tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/erp/empty-state";
import { toastError } from "@/lib/errors/toast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BookOpenCheck, CheckCircle2, Undo2, Lock } from "lucide-react";

const ATTENDANCE = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
type Attendance = (typeof ATTENDANCE)[number];

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ENTERPRISE_APPROVED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  RETURNED: "bg-destructive/15 text-destructive",
  LOCKED: "bg-primary/15 text-primary",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function EnterprisePortal() {
  const qc = useQueryClient();
  const load = useServerFn(listEnterprisePracticalWork);
  const confirm = useServerFn(confirmPracticalTask);
  const decide = useServerFn(decidePracticalTask);
  const correct = useServerFn(correctPracticalTask);

  const roster = useQuery({
    queryKey: ["enterprise-portal", "roster"],
    queryFn: () => load(),
    staleTime: 10_000,
  });

  const placements = (roster.data?.placements ?? []) as any[];
  const confirmations = (roster.data?.confirmations ?? []) as any[];
  const planTasks = (roster.data?.planTasks ?? []) as any[];

  const [selected, setSelected] = useState<string | null>(null);
  const placement = placements.find((p) => p.id === (selected ?? placements[0]?.id)) ?? null;

  const [form, setForm] = useState({
    plan_task_id: "",
    task_title: "",
    task_date: today(),
    attendance: "PRESENT" as Attendance,
    hours: "4",
    performance_rating: "3",
    safety_breach: false,
    remarks: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState<Record<string, string>>({});

  const rows = useMemo(
    () => confirmations.filter((c) => c.placement_id === placement?.id),
    [confirmations, placement?.id],
  );

  async function run(key: string, fn: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(message);
      await qc.invalidateQueries({ queryKey: ["enterprise-portal"] });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  }

  function submitTask() {
    if (!placement) return;
    const plan = planTasks.find((t) => t.id === form.plan_task_id);
    const title = plan?.title || form.task_title.trim();
    if (title.length < 2) {
      toast.error("Choose a planned task or type the task performed.");
      return;
    }
    void run(
      "create",
      () =>
        confirm({
          data: {
            placement_id: placement.id,
            plan_task_id: form.plan_task_id || null,
            task_title: title,
            competency_code: plan?.competency_code ?? null,
            task_date: form.task_date,
            attendance: form.attendance,
            hours: Number(form.hours) || 0,
            performance_rating: Number(form.performance_rating) || 3,
            safety_breach: form.safety_breach,
            remarks: form.remarks || null,
          },
        }),
      "Task confirmation recorded",
    );
  }

  if (!roster.isLoading && placements.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState
          icon={BookOpenCheck}
          title="No trainees assigned yet"
          description="Trainees appear here as soon as the college places them at your enterprise and the placement becomes active."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Enterprise logbook portal</h1>
        <p className="text-xs text-muted-foreground">
          Record enterprise attendance per practical task, then approve or return the trainee's sub-session logbook.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workplace roster</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {placements.map((p) => {
            const active = p.id === placement?.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <span className="block font-medium">{p.students?.full_name ?? "Trainee"}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {p.students?.registration_number ?? "—"} · {p.departments?.name ?? ""}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {placement && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Confirm a practical task</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Planned task</Label>
              <Select
                value={form.plan_task_id || "free"}
                onValueChange={(v) => setForm((f) => ({ ...f, plan_task_id: v === "free" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select a planned sub-session" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Other (type below)</SelectItem>
                  {planTasks
                    .filter((t) => t.department_id === placement.department_id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                        {t.competency_code ? ` · ${t.competency_code}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {!form.plan_task_id && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Task performed</Label>
                <Input
                  value={form.task_title}
                  placeholder="e.g. Terminate CAT6 patch panel"
                  onChange={(e) => setForm((f) => ({ ...f, task_title: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.task_date} onChange={(e) => setForm((f) => ({ ...f, task_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attendance</Label>
              <Select value={form.attendance} onValueChange={(v) => setForm((f) => ({ ...f, attendance: v as Attendance }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hours</Label>
              <Input type="number" min={0} max={24} step="0.5" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Performance (1–5)</Label>
              <Input type="number" min={1} max={5} value={form.performance_rating} onChange={(e) => setForm((f) => ({ ...f, performance_rating: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.safety_breach} onCheckedChange={(v) => setForm((f) => ({ ...f, safety_breach: v }))} />
              <span className="text-xs">Safety breach observed</span>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={busy === "create"} onClick={submitTask}>
                {busy === "create" ? "Saving…" : "Record confirmation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sub-session logbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && <EmptyState title="Nothing recorded yet" description="Confirmations for this trainee will be listed here." />}
          {rows.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.task_title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.task_date} · {c.attendance} · {c.hours}h · rating {c.performance_rating}
                    {c.safety_breach ? " · safety breach" : ""}
                  </p>
                </div>
                <Badge className={cn("text-[10px]", STATUS_TONE[c.status])} variant="secondary">{c.status}</Badge>
              </div>
              {c.decision_comment && <p className="mt-1 text-[11px] text-muted-foreground">Note: {c.decision_comment}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.status === "SUBMITTED" && (
                  <>
                    <Button
                      size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      disabled={busy === c.id}
                      onClick={() => run(c.id, () => decide({ data: { confirmation_id: c.id, decision: "APPROVE", comment: comment[c.id] || null, expected_version: c.version } }), "Approved")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      disabled={busy === c.id}
                      onClick={() => run(c.id, () => decide({ data: { confirmation_id: c.id, decision: "RETURN", comment: comment[c.id] || null, expected_version: c.version } }), "Returned to trainee")}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Return
                    </Button>
                    <Input
                      className="h-7 max-w-xs text-xs"
                      placeholder="Comment (required to return)"
                      value={comment[c.id] ?? ""}
                      onChange={(e) => setComment((m) => ({ ...m, [c.id]: e.target.value }))}
                    />
                  </>
                )}
                {c.status === "ENTERPRISE_APPROVED" && (
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1 text-xs"
                    disabled={busy === c.id}
                    onClick={() => run(c.id, () => decide({ data: { confirmation_id: c.id, decision: "LOCK", comment: null, expected_version: c.version } }), "Locked")}
                  >
                    <Lock className="h-3.5 w-3.5" /> Lock
                  </Button>
                )}
                {c.status !== "LOCKED" && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCorrecting(correcting === c.id ? null : c.id); setReason(""); }}>
                    Correct
                  </Button>
                )}
              </div>

              {correcting === c.id && (
                <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2">
                  <p className="text-[11px] text-muted-foreground">
                    Corrections are logged with the old and new values. A written reason is required.
                  </p>
                  <Textarea rows={2} placeholder="Why is this being corrected?" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button
                    size="sm" className="h-7 text-xs"
                    disabled={busy === c.id}
                    onClick={() =>
                      run(c.id, () => correct({
                        data: {
                          confirmation_id: c.id,
                          attendance: c.attendance as Attendance,
                          hours: Number(c.hours),
                          performance_rating: Number(c.performance_rating),
                          safety_breach: Boolean(c.safety_breach),
                          remarks: c.remarks ?? null,
                          reason,
                          expected_version: c.version,
                        },
                      }), "Correction logged").then(() => setCorrecting(null))
                    }
                  >
                    Save correction
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/enterprise-portal")({
  head: () => ({
    meta: [
      { title: "Enterprise Logbook Portal | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Enterprise trainers confirm practical sub-session tasks, record workplace attendance and approve trainee logbooks." },
      { property: "og:title", content: "Enterprise Logbook Portal" },
      { property: "og:description", content: "Workplace roster, sub-session sign-off and attendance verification for industry trainers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnterprisePortal,
});
