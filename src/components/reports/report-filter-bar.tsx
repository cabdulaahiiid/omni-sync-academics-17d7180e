import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { ReportFilters } from "@/lib/reports.functions";

type Options = {
  departments: { id: string; name: string }[];
  trainers: { id: string; full_name: string }[];
  modules: { id: string; code: string; name: string }[];
  semesters: { id: string; name: string }[];
  academic_years: string[];
};

const NONE = "__none__";

export function ReportFilterBar({
  value,
  options,
  onChange,
  onReset,
}: {
  value: ReportFilters;
  options?: Options;
  onChange: (next: ReportFilters) => void;
  onReset: () => void;
}) {
  const update = (patch: Partial<ReportFilters>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
      <Field label="Academic year">
        <Select
          value={value.academic_year ?? NONE}
          onValueChange={(v) => update({ academic_year: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All</SelectItem>
            {(options?.academic_years ?? []).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Level">
        <Select
          value={value.semester_id ?? NONE}
          onValueChange={(v) => update({ semester_id: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All</SelectItem>
            {(options?.semesters ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Department">
        <Select
          value={value.department_id ?? NONE}
          onValueChange={(v) => update({ department_id: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All</SelectItem>
            {(options?.departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Trainer">
        <Select
          value={value.trainer_registry_id ?? NONE}
          onValueChange={(v) => update({ trainer_registry_id: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All</SelectItem>
            {(options?.trainers ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Module">
        <Select
          value={value.module_id ?? NONE}
          onValueChange={(v) => update({ module_id: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>All</SelectItem>
            {(options?.modules ?? []).map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="From">
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={value.date_from ?? ""}
          onChange={(e) => update({ date_from: e.target.value || undefined })}
        />
      </Field>
      <Field label="To">
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={value.date_to ?? ""}
          onChange={(e) => update({ date_to: e.target.value || undefined })}
        />
      </Field>
      <Field label="Status">
        <Select
          value={value.status ?? NONE}
          onValueChange={(v) => update({ status: v === NONE ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Any" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Any</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button variant="ghost" size="sm" onClick={onReset} className="h-9">
        <X className="mr-1 h-4 w-4" /> Reset
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
