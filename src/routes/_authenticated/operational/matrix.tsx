import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getWeeklyMatrix,
  swapTrainer,
  validateScheduleEdit,
  getConflictPanelOptions,
} from "@/lib/dh-extras.functions";
import { updateDraftSession } from "@/lib/level-drafts.functions";
import { dhResubmitWeek } from "@/lib/feedback.functions";
import { useMe } from "@/hooks/use-me";
import { listTrainers } from "@/lib/dh.functions";
import { listSemesters } from "@/lib/ma.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeftRight, ChevronLeft, ChevronRight, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operational/matrix")({
  component: WeeklyMatrix,
});

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);

function WeeklyMatrix() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const deptId = me?.profile?.department_id;
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [semesterId, setSemesterId] = useState<string>("");
  const matrix = useServerFn(getWeeklyMatrix);
  const swap = useServerFn(swapTrainer);
  const trainersFn = useServerFn(listTrainers);
  const semsFn = useServerFn(listSemesters);
  const validateFn = useServerFn(validateScheduleEdit);
  const optionsFn = useServerFn(getConflictPanelOptions);
  const updateFn = useServerFn(updateDraftSession);
  const resubmitWeekFn = useServerFn(dhResubmitWeek);

  const { data } = useQuery({
    queryKey: ["dh-matrix", fmt(weekStart), semesterId],
    queryFn: () => matrix({ data: { week_start: fmt(weekStart), semester_id: semesterId || undefined } }),
    staleTime: 15000,
  });
  const { data: trainers } = useQuery({
    queryKey: ["dh-trainers"], queryFn: () => trainersFn(), staleTime: 60000,
  });
  const { data: levels } = useQuery({
    queryKey: ["semesters"], queryFn: () => semsFn(), staleTime: 60000,
  });
  const { data: options } = useQuery({
    queryKey: ["conflict-options", deptId],
    queryFn: () => optionsFn({ data: { department_id: deptId! } }),
    enabled: !!deptId,
    staleTime: 60000,
  });

  const [swapTarget, setSwapTarget] = useState<any | null>(null);
  const [patch, setPatch] = useState<{
    trainer_registry_id?: string;
    venue_id?: string;
    section_id?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
  }>({});
  const [validation, setValidation] = useState<{ ok: boolean; conflicts: any[] } | null>(null);

  useEffect(() => {
    setPatch({});
    setValidation(null);
  }, [swapTarget?.id]);

  const validateMut = useMutation({
    mutationFn: () =>
      validateFn({ data: { schedule_id: swapTarget!.id, patch } }),
    onSuccess: (r) => {
      setValidation(r);
      if (r.ok) toast.success("No conflicts. Ready to apply & resubmit.");
      else toast.warning(`${r.conflicts.length} conflict(s) remain`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      const cleanPatch: Record<string, any> = {};
      for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
        const v = patch[k];
        if (v == null || v === "") continue;
        if ((k === "start_time" || k === "end_time") && typeof v === "string" && v.length === 5) {
          cleanPatch[k] = v + ":00";
        } else {
          cleanPatch[k] = v;
        }
      }
      await updateFn({ data: { schedule_id: swapTarget!.id, patch: cleanPatch } });
      if (swapTarget?.week_num && swapTarget?.semester_id) {
        await resubmitWeekFn({ data: { semester_id: swapTarget.semester_id, week_num: swapTarget.week_num } });
      }
    },
    onSuccess: () => {
      toast.success("Edit applied and week resubmitted to Admin");
      qc.invalidateQueries({ queryKey: ["dh-matrix"] });
      setSwapTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });

  const byDate: Record<string, any[]> = {};
  for (const s of data?.schedules ?? []) {
    (byDate[s.date] ??= []).push(s);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Weekly Schedule Matrix</h1>
          <p className="text-sm text-muted-foreground">Conflicts highlighted. Click a session to swap trainer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semesterId || "all"} onValueChange={(v) => setSemesterId(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="All levels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {(levels ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d);
          }}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">
            {fmt(weekStart)} → {fmt(days[6])}
          </span>
          <Button size="sm" variant="outline" onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d);
          }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const ds = fmt(d);
          const cells = byDate[ds] ?? [];
          return (
            <Card key={ds} className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                  <span className="ml-1 text-muted-foreground">{d.getDate()}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 p-2 pt-0">
                {cells.length === 0 && <p className="text-[10px] text-muted-foreground">—</p>}
                {cells.map((s) => (
                  <button key={s.id} onClick={() => setSwapTarget(s)}
                    className={cn(
                      "w-full rounded-md border p-2 text-left text-[11px] transition-colors hover:bg-accent/50",
                      s.has_conflict && "border-rose/60 bg-rose/5",
                    )}>
                    <p className="truncate font-medium">{s.module_code}</p>
                    <p className="truncate text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                    <p className="truncate text-muted-foreground">{s.trainer_name}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant="outline" className="px-1 py-0 text-[9px]">{s.status}</Badge>
                      {s.has_conflict && <AlertTriangle className="h-3 w-3 text-rose" />}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!swapTarget} onOpenChange={(o) => !o && setSwapTarget(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose" /> Conflict Resolution Panel
            </SheetTitle>
          </SheetHeader>
          {swapTarget && (
            <div className="mt-4 space-y-4 text-sm">
              {swapTarget.has_conflict && (
                <div className="rounded-md border border-rose/40 bg-rose/5 p-2 text-[11px]">
                  Conflict detected on this session. Adjust any field below and re-validate.
                </div>
              )}
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="font-medium">{swapTarget.module_code} · {swapTarget.module_name}</p>
                <p className="text-xs text-muted-foreground">
                  Original: {swapTarget.date} · {swapTarget.start_time?.slice(0,5)}–{swapTarget.end_time?.slice(0,5)}
                </p>
                <p className="mt-1 text-xs">Trainer: {swapTarget.trainer_name}</p>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Trainer</Label>
                  <Select value={patch.trainer_registry_id ?? swapTarget.trainer_registry_id}
                    onValueChange={(v) => setPatch((p) => ({ ...p, trainer_registry_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(options?.trainers ?? trainers ?? []).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Venue / Room</Label>
                  <Select value={patch.venue_id ?? swapTarget.venue_id}
                    onValueChange={(v) => setPatch((p) => ({ ...p, venue_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choose venue" /></SelectTrigger>
                    <SelectContent>
                      {(options?.venues ?? []).map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Section</Label>
                  <Select value={patch.section_id ?? ""}
                    onValueChange={(v) => setPatch((p) => ({ ...p, section_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Keep current" /></SelectTrigger>
                    <SelectContent>
                      {(options?.sections ?? []).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={patch.date ?? swapTarget.date}
                      onChange={(e) => setPatch((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Start</Label>
                    <Input type="time" value={patch.start_time ?? swapTarget.start_time?.slice(0,5)}
                      onChange={(e) => setPatch((p) => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <Input type="time" value={patch.end_time ?? swapTarget.end_time?.slice(0,5)}
                      onChange={(e) => setPatch((p) => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full" disabled={validateMut.isPending}
                onClick={() => validateMut.mutate()}>
                {validateMut.isPending ? "Checking…" : "Validate Conflict Resolution"}
              </Button>

              {validation && (
                validation.ok ? (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-50 p-2 text-[12px] text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> No remaining conflicts.
                  </div>
                ) : (
                  <div className="rounded-md border border-rose/40 bg-rose/5 p-2 text-[12px]">
                    <p className="font-medium text-rose mb-1">{validation.conflicts.length} conflict(s) remain:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {validation.conflicts.map((c: any, i: number) => (
                        <li key={i}>{c.kind.toUpperCase()} clash with {c.with_label}</li>
                      ))}
                    </ul>
                  </div>
                )
              )}

              <Button className="w-full"
                disabled={!validation?.ok || applyMut.isPending}
                onClick={() => applyMut.mutate()}>
                <Send className="mr-2 h-4 w-4" />
                {applyMut.isPending ? "Applying…" : "Apply & Resubmit Schedule"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}