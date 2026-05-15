import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWeeklyMatrix, swapTrainer } from "@/lib/dh-extras.functions";
import { listMyTrainers } from "@/lib/dh.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const matrix = useServerFn(getWeeklyMatrix);
  const swap = useServerFn(swapTrainer);
  const trainersFn = useServerFn(listMyTrainers);

  const { data } = useQuery({
    queryKey: ["dh-matrix", fmt(weekStart)],
    queryFn: () => matrix({ data: { week_start: fmt(weekStart) } }),
    staleTime: 15000,
  });
  const { data: trainers } = useQuery({
    queryKey: ["dh-trainers"], queryFn: () => trainersFn(), staleTime: 60000,
  });

  const [swapTarget, setSwapTarget] = useState<any | null>(null);
  const [newTrainer, setNewTrainer] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const swapMut = useMutation({
    mutationFn: () =>
      swap({ data: { schedule_id: swapTarget!.id, new_trainer_id: newTrainer, reason } }),
    onSuccess: () => {
      toast.success("Trainer swapped");
      qc.invalidateQueries({ queryKey: ["dh-matrix"] });
      setSwapTarget(null); setNewTrainer(""); setReason("");
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
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Swap trainer</SheetTitle>
          </SheetHeader>
          {swapTarget && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="font-medium">{swapTarget.module_code} · {swapTarget.module_name}</p>
                <p className="text-xs text-muted-foreground">{swapTarget.date} · {swapTarget.start_time}–{swapTarget.end_time}</p>
                <p className="mt-1 text-xs">Current: {swapTarget.trainer_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium">New trainer</label>
                <Select value={newTrainer} onValueChange={setNewTrainer}>
                  <SelectTrigger><SelectValue placeholder="Choose trainer" /></SelectTrigger>
                  <SelectContent>
                    {(trainers ?? []).map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Reason (audit log)</label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. trainer on emergency leave" />
              </div>
              <Button className="w-full" disabled={!newTrainer || reason.trim().length < 3 || swapMut.isPending}
                onClick={() => swapMut.mutate()}>
                {swapMut.isPending ? "Swapping…" : "Confirm swap"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}