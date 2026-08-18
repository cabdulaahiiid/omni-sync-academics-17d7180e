import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCtDepartmentSetup, saveCtDepartmentConfig, saveCtCompetency, deleteCtCompetency,
} from "@/lib/ct/department-config.functions";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-me";
import { toast } from "sonner";
import { explainError } from "@/lib/errors/explain";

function SettingsPage() {
  const { data: me } = useMe();
  const roles = (me?.roles ?? []) as string[];
  const isAdmin = roles.includes("MA");
  const qc = useQueryClient();
  const load = useServerFn(getCtDepartmentSetup);
  const saveConfig = useServerFn(saveCtDepartmentConfig);
  const saveComp = useServerFn(saveCtCompetency);
  const delComp = useServerFn(deleteCtCompetency);

  const { data, isLoading } = useQuery({ queryKey: ["ct", "dept-setup"], queryFn: () => load() });
  const [deptOverride, setDeptOverride] = useState<string | null>(null);
  const departmentId = deptOverride ?? data?.myDepartmentId ?? (isAdmin ? data?.departments?.[0]?.id ?? null : null);

  const config = useMemo(
    () => (data?.configs ?? []).find((c: any) => c.department_id === departmentId) ?? null,
    [data, departmentId],
  );
  const competencies = (data?.competencies ?? []).filter((c: any) => c.department_id === departmentId);

  const [form, setForm] = useState<Record<string, string>>({});
  const value = (key: string, fallback: number) =>
    form[key] ?? String(config?.[key] ?? fallback);
  const num = (key: string, fallback: number) => Number(value(key, fallback));
  const total = num("weight_daily", 40) + num("weight_industry", 40) + num("weight_tvet", 20);

  const [newComp, setNewComp] = useState({ name: "", description: "", critical: false });

  async function onSaveConfig() {
    if (!departmentId) return;
    try {
      await saveConfig({
        data: {
          department_id: departmentId,
          weight_daily: num("weight_daily", 40),
          weight_industry: num("weight_industry", 40),
          weight_tvet: num("weight_tvet", 20),
          passing_threshold: num("passing_threshold", 60),
          attendance_threshold: num("attendance_threshold", 80),
          max_allowed_gaps: num("max_allowed_gaps", 0),
        },
      });
      toast.success("Evaluation settings saved for this department.");
      await qc.invalidateQueries({ queryKey: ["ct", "dept-setup"] });
    } catch (e) {
      toast.error(explainError(e).what, { description: explainError(e).how });
    }
  }

  async function onAddCompetency() {
    if (!departmentId) return;
    try {
      await saveComp({
        data: {
          department_id: departmentId,
          name: newComp.name,
          description: newComp.description || null,
          critical: newComp.critical,
          sort_order: competencies.length,
          active: true,
        },
      });
      setNewComp({ name: "", description: "", critical: false });
      toast.success("Competency added to your department checklist.");
      await qc.invalidateQueries({ queryKey: ["ct", "dept-setup"] });
    } catch (e) {
      toast.error(explainError(e).what, { description: explainError(e).how });
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading department setup…</p>;
  if (!departmentId) {
    return <EmptyState title="No department" description="Your account is not linked to a department yet — ask an administrator to assign one." />;
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <WorkspaceCard title="Department" description="Administrators can configure any department.">
          <Select value={departmentId} onValueChange={setDeptOverride}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choose a department" /></SelectTrigger>
            <SelectContent>
              {(data?.departments ?? []).map((d: any) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceCard>
      )}

      <WorkspaceCard
        title="Evaluation formula"
        description="The three weights must add up to 100. These values decide the composite score and the Green / Yellow / Red status for this department only."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ["weight_daily", "Daily log weight (%)", 40],
            ["weight_industry", "Industry evaluation weight (%)", 40],
            ["weight_tvet", "College trainer weight (%)", 20],
            ["passing_threshold", "Passing score (%)", 60],
            ["attendance_threshold", "Minimum attendance (%)", 80],
            ["max_allowed_gaps", "Skill gaps tolerated", 0],
          ] as const).map(([key, label, fallback]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={0}
                value={value(key, fallback)}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variant={Math.round(total) === 100 ? "secondary" : "destructive"}>
            Weights total {Math.round(total)}%
          </Badge>
          <Button onClick={onSaveConfig} disabled={Math.round(total) !== 100}>Save evaluation settings</Button>
          {Math.round(total) !== 100 && (
            <span className="text-xs text-destructive">Adjust the weights so they add up to exactly 100%.</span>
          )}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        title="Practical competency checklist"
        description="The skills the industry trainer rates for this department. Mark safety-critical items so a breach turns the final status red."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="comp-name">Competency</Label>
            <Input id="comp-name" placeholder="e.g. Safe use of hand and power tools"
              value={newComp.name} onChange={(e) => setNewComp((c) => ({ ...c, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-desc">Description (optional)</Label>
            <Input id="comp-desc" placeholder="What the trainee must demonstrate"
              value={newComp.description} onChange={(e) => setNewComp((c) => ({ ...c, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="comp-critical" checked={newComp.critical}
              onCheckedChange={(v) => setNewComp((c) => ({ ...c, critical: v }))} />
            <Label htmlFor="comp-critical" className="text-xs">Safety critical</Label>
          </div>
          <Button onClick={onAddCompetency} disabled={newComp.name.trim().length < 2}>Add</Button>
        </div>

        <div className="mt-4">
          {competencies.length === 0 ? (
            <EmptyState title="No competencies yet" description="Add the practical skills your department assesses during placement." />
          ) : (
            <DataTable head={["#", "Competency", "Description", "Safety critical", ""]}>
              {competencies.map((c: any, i: number) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2 text-xs text-muted-foreground">{c.description ?? "—"}</td>
                  <td className="p-2">{c.critical ? <Badge variant="destructive">Critical</Badge> : <Badge variant="outline">Standard</Badge>}</td>
                  <td className="p-2 text-right">
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        try {
                          await delComp({ data: { id: c.id } });
                          await qc.invalidateQueries({ queryKey: ["ct", "dept-setup"] });
                        } catch (e) {
                          toast.error(explainError(e).what, { description: explainError(e).how });
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </WorkspaceCard>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/settings")({
  head: () => ({
    meta: [
      { title: "Department Practical Setup | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Define your department's practical competency checklist and evaluation weights for industrial training." },
      { property: "og:title", content: "Department Practical Training Setup" },
      { property: "og:description", content: "Competency checklist, evaluation weights and pass thresholds per department." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});
