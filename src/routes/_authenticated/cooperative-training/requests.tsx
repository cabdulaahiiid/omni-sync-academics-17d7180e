import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CT_KEYS } from "@/lib/ct/keys";
import { getCtCurriculum } from "@/lib/ct/curriculum.functions";
import {
  createCtRequest, delegateCtRequest, listCtCoordinators, listCtEligibleTrainees,
  listCtRequests, submitCtRequest,
} from "@/lib/ct/requests.functions";
import { useMasterData } from "@/hooks/use-master-data";
import { listCtDepartmentTrainers } from "@/lib/ct/trainers.functions";
import { useMe } from "@/hooks/use-me";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { toastError } from "@/lib/errors/toast";
import { ErrorPanel } from "@/components/forms/error-panel";
import { FormBody, FormGrid, FormSection } from "@/components/forms/layout";
import { SelectField, TextField } from "@/components/forms/fields";
import { StatusBadge } from "@/components/erp/status-badge";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function RequestsPage() {
  const { data: me } = useMe();
  const roles = (me?.roles ?? []) as string[];
  const isAdmin = roles.includes("MA");
  const isIndustrialDh = Boolean(me?.isIndustrialDh);
  const isSupervisor = roles.includes("IPS");
  const master = useMasterData();
  const curriculumFn = useServerFn(getCtCurriculum);
  const listFn = useServerFn(listCtRequests);
  const eligibleFn = useServerFn(listCtEligibleTrainees);
  const coordinatorsFn = useServerFn(listCtCoordinators);
  const createFn = useServerFn(createCtRequest);
  const submitFn = useServerFn(submitCtRequest);
  const delegateFn = useServerFn(delegateCtRequest);

  const curriculum = useQuery({ queryKey: CT_KEYS.curriculum, queryFn: () => curriculumFn(), staleTime: 60_000 });
  const requests = useQuery({ queryKey: CT_KEYS.requests, queryFn: () => listFn(), staleTime: 10_000 });
  const coordinators = useQuery({ queryKey: ["ct", "coordinators"], queryFn: () => coordinatorsFn(), staleTime: 60_000 });
  const trainersFn = useServerFn(listCtDepartmentTrainers);
  const deptTrainers = useQuery({
    queryKey: ["ct", "department-trainers", form.department_id],
    queryFn: () => trainersFn({ data: { department_id: form.department_id } }),
    enabled: Boolean(form.department_id),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    department_id: "", occupation_id: "", level_id: "", section_id: "",
    title: "", notes: "", requested_start_date: "", requested_end_date: "",
  });
  const [selected, setSelected] = useState<string[]>([]);

  // A Department Head can only file for the Industrial Department; the picker
  // is locked to it so the department can never be swapped in the browser.
  const lockedDepartmentId = !isAdmin && isIndustrialDh ? (me?.industrialDepartmentId ?? "") : "";
  useEffect(() => {
    if (lockedDepartmentId && form.department_id !== lockedDepartmentId) {
      setForm((f) => ({ ...f, department_id: lockedDepartmentId, level_id: "", section_id: "" }));
    }
  }, [lockedDepartmentId, form.department_id]);

  const eligible = useQuery({
    queryKey: ["ct", "eligible", form.department_id, form.level_id, form.section_id],
    queryFn: () =>
      eligibleFn({
        data: {
          department_id: form.department_id || null,
          level_id: form.level_id || null,
          section_id: form.section_id || null,
        },
      }),
    enabled: Boolean(form.department_id),
  });

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!form.department_id) m.push("Department");
    if (!form.occupation_id) m.push("Occupation");
    if (!form.title.trim()) m.push("Request title");
    if (!form.requested_start_date) m.push("Start date");
    if (!form.requested_end_date) m.push("End date");
    if (selected.length === 0) m.push("At least one trainee");
    return m;
  }, [form, selected]);

  const create = useFormSubmit({
    mutationFn: () => createFn({ data: { ...form, notes: form.notes || null, level_id: form.level_id || null, section_id: form.section_id || null, student_ids: selected } }),
    invalidateKeys: [CT_KEYS.requests, CT_KEYS.overview],
    successMessage: "Practical training request saved as draft.",
    onSaved: () => {
      setSelected([]);
      setForm((f) => ({ ...f, title: "", notes: "" }));
    },
  });

  async function submitRequest(id: string) {
    try {
      await submitFn({ data: { request_id: id } });
      await requests.refetch();
    } catch (e) { toastError(e); }
  }

  async function delegate(id: string, to: string) {
    try {
      await delegateFn({ data: { request_id: id, to_user_id: to, note: null } });
      await requests.refetch();
    } catch (e) { toastError(e); }
  }

  // Only the Industrial Department Head (plus Admin and the Supervisor) may
  // start a practical training request. Other DHs get read-only access.
  const canCreate = isAdmin || isSupervisor || isIndustrialDh;
  const canDelegate = roles.some((r) => ["MA", "IPS"].includes(r));

  return (
    <div className="space-y-6">
      {!canCreate && (
        <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Practical training requests are initiated by the Industrial Department Head. You can follow the requests that belong to your department below.
        </p>
      )}
      {canCreate && (
        <Card>
          <CardHeader><CardTitle className="text-sm">New practical training request</CardTitle></CardHeader>
          <CardContent>
            <FormBody>
              <FormSection title="Request details">
                <FormGrid>
                  <SelectField
                    label="Department" required value={form.department_id}
                    disabled={Boolean(lockedDepartmentId)}
                    onChange={(v) => setForm((f) => ({ ...f, department_id: v, level_id: "", section_id: "" }))}
                    options={(lockedDepartmentId
                      ? master.departments.filter((d: any) => d.id === lockedDepartmentId)
                      : master.departments
                    ).map((d: any) => ({ value: d.id, label: d.name }))}
                  />
                  <SelectField
                    label="Occupation" required value={form.occupation_id}
                    onChange={(v) => setForm((f) => ({ ...f, occupation_id: v }))}
                    options={(curriculum.data?.occupations ?? []).map((o: any) => ({ value: o.id, label: `${o.code} — ${o.name}` }))}
                  />
                  <SelectField
                    label="Level" value={form.level_id}
                    onChange={(v) => setForm((f) => ({ ...f, level_id: v, section_id: "" }))}
                    options={master.levelsFor(form.department_id).map((l: any) => ({ value: l.id, label: master.labelForLevel(l) }))}
                  />
                  <SelectField
                    label="Section" value={form.section_id}
                    onChange={(v) => setForm((f) => ({ ...f, section_id: v }))}
                    options={master.sectionsFor(form.level_id, form.department_id).map((s: any) => ({ value: s.id, label: s.name }))}
                  />
                  <TextField
                    label="Request title" required value={form.title}
                    onChange={(v) => setForm((f) => ({ ...f, title: v }))}
                    placeholder="e.g. Level III BEI industrial attachment — Term 1"
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.requested_start_date} onChange={(e) => setForm((f) => ({ ...f, requested_start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={form.requested_end_date} onChange={(e) => setForm((f) => ({ ...f, requested_end_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Notes for the coordinator</Label>
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. prefer enterprises near the college" />
                  </div>
                </FormGrid>
              </FormSection>

              <FormSection title="Theory completion queue" description="Trainees below the theory threshold can still be selected manually — the request is then flagged MANUALLY INITIATED for the supervisor.">
                {!form.department_id ? (
                  <p className="text-sm text-muted-foreground">Choose a department to load trainees.</p>
                ) : eligible.isLoading ? (
                  <p className="text-sm text-muted-foreground">Checking theory completion…</p>
                ) : (
                  <div className="max-h-72 overflow-auto rounded-lg border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr><th className="p-2 text-left">Add</th><th className="p-2 text-left">Trainee</th><th className="p-2 text-left">ID</th><th className="p-2 text-left">Theory</th><th className="p-2 text-left">Status</th></tr>
                      </thead>
                      <tbody>
                        {(eligible.data?.students ?? []).map((s: any) => (
                          <tr key={s.id} className="border-t border-border/60">
                            <td className="p-2">
                              <Checkbox
                                checked={selected.includes(s.id)}
                                disabled={s.already_placed}
                                onCheckedChange={(c) =>
                                  setSelected((prev) => (c ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                                }
                              />
                            </td>
                            <td className="p-2">{s.full_name}</td>
                            <td className="p-2 text-muted-foreground">{s.registration_number}</td>
                            <td className="p-2">{s.theory_percent === null ? "—" : `${s.theory_percent}%`}</td>
                            <td className="p-2">
                              {s.already_placed ? <Badge variant="secondary">Already placed</Badge>
                                : s.eligible ? <Badge>Eligible</Badge>
                                : <Badge variant="outline">Manual — below {eligible.data?.threshold ?? 80}%</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </FormSection>

              <FormSection
                title="Department trainer capacity"
                description="Trainers registered to the selected department, their current practical-training load and the department competency tags they cover."
              >
                {!form.department_id ? (
                  <p className="text-sm text-muted-foreground">Choose a department to see its trainers.</p>
                ) : deptTrainers.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading trainers…</p>
                ) : (deptTrainers.data?.trainers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No trainers are registered to this department yet.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(deptTrainers.data?.trainers ?? []).map((t: any) => (
                        <div key={t.id} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">
                          <span className="font-medium">{t.full_name}</span>
                          <span className="text-muted-foreground"> · {t.assigned_load} trainee(s)</span>
                          <Badge className="ml-2" variant={t.availability === "FULL" ? "outline" : "secondary"}>
                            {t.availability === "FULL" ? "At capacity" : t.availability === "FREE" ? "Free" : "Available"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {(deptTrainers.data?.competencies ?? []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Department competencies: {(deptTrainers.data?.competencies ?? []).map((c: any) => c.name).join(", ")}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Assign the responsible trainer per trainee on the Placements screen once the request is allocated.
                    </p>
                  </div>
                )}
              </FormSection>

              {selected.some((id) => {
                const s = (eligible.data?.students ?? []).find((x: any) => x.id === id);
                return s && !s.eligible;
              }) && (
                <p className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  MANUALLY INITIATED — THEORY &lt; {eligible.data?.threshold ?? 80}%. This will be recorded on the request and shown to the supervisor.
                </p>
              )}
              {missing.length > 0 && (
                <p className="text-xs text-muted-foreground">Still required: {missing.join(", ")}.</p>
              )}
              <ErrorPanel error={create.error} />
              <div className="flex justify-end">
                <Button disabled={missing.length > 0 || create.isSaving} onClick={() => create.submit()}>
                  {create.isSaving ? "Saving…" : "Save request"}
                </Button>
              </div>
            </FormBody>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Requests</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(requests.data?.requests ?? []).length === 0 ? (
            <EmptyState title="No requests yet" description="Create a request to start the placement workflow." />
          ) : (
            (requests.data?.requests ?? []).map((r: any) => {
              const members = (requests.data?.members ?? []).filter((m: any) => m.request_id === r.id);
              return (
                <div key={r.id} className="rounded-lg border border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{r.reference} · {r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.requested_start_date} → {r.requested_end_date} · {members.length} trainee(s)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {r.status === "DRAFT" && (
                        <Button size="sm" variant="outline" onClick={() => submitRequest(r.id)}>Submit</Button>
                      )}
                      {canDelegate && ["SUBMITTED", "DELEGATED"].includes(r.status) && (
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          defaultValue=""
                          onChange={(e) => e.target.value && delegate(r.id, e.target.value)}
                        >
                          <option value="">Delegate to…</option>
                          {(coordinators.data ?? []).map((c: any) => (
                            <option key={c.id} value={c.id}>{c.full_name} ({c.roles.join("/")})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  {members.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {members.map((m: any) => m.students?.full_name).filter(Boolean).join(", ")}
                    </p>
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

export const Route = createFileRoute("/_authenticated/cooperative-training/requests")({ component: RequestsPage });
