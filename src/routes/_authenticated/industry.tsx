import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCtIndustryRoster, submitCtDailyLog } from "@/lib/ct/daily-logs.functions";
import { enqueueCtDailyLog, flushCtDailyLogs, getCtLogCounts, clearSyncedCtLogs } from "@/lib/offline/ct-daily-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/erp/empty-state";
import { toast } from "sonner";
import { explainError } from "@/lib/errors/explain";
import { cn } from "@/lib/utils";
import { HardHat, CloudOff, RefreshCw } from "lucide-react";

const ATTENDANCE = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;
type Attendance = (typeof ATTENDANCE)[number];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function IndustryTrainerApp() {
  const qc = useQueryClient();
  const load = useServerFn(listCtIndustryRoster);
  const submit = useServerFn(submitCtDailyLog);
  const { data, isLoading } = useQuery({ queryKey: ["ct", "industry-roster"], queryFn: () => load() });

  const placements = data?.placements ?? [];
  const [placementId, setPlacementId] = useState<string | null>(null);
  const active = useMemo(
    () => placements.find((p: any) => p.id === placementId) ?? placements[0] ?? null,
    [placements, placementId],
  );

  const tags = useMemo(
    () => (data?.competencies ?? []).filter((c: any) => !active || c.department_id === active.department_id),
    [data, active],
  );

  const [form, setForm] = useState({
    log_date: today(),
    attendance: "PRESENT" as Attendance,
    shift_hours: "8",
    score: "4",
    safety_breach: false,
    task_notes: "",
    safety_notes: "",
    gap_tags: [] as string[],
  });
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  const refreshCounts = useCallback(async () => {
    try {
      const c = await getCtLogCounts();
      setPending(c.pending);
    } catch { /* no IndexedDB */ }
  }, []);

  const flush = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    setSyncing(true);
    try {
      const report = await flushCtDailyLogs((args) => submit(args as any) as any);
      await clearSyncedCtLogs();
      await refreshCounts();
      if (report.applied > 0) {
        toast.success(`${report.applied} daily log(s) synced.`);
        await qc.invalidateQueries({ queryKey: ["ct", "industry-roster"] });
      }
    } catch { /* retried on the next pass */ } finally {
      setSyncing(false);
    }
  }, [submit, refreshCounts, qc]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void refreshCounts();
    void flush();
    const timer = window.setInterval(() => { if (navigator.onLine) void flush(); }, 30_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(timer);
    };
  }, [flush, refreshCounts]);

  async function onSave() {
    if (!active) return;
    const payload = {
      client_uuid: crypto.randomUUID(),
      placement_id: active.id as string,
      log_date: form.log_date,
      attendance: form.attendance,
      shift_hours: Number(form.shift_hours || 0),
      score: form.attendance === "ABSENT" ? null : Number(form.score),
      safety_breach: form.safety_breach,
      task_notes: form.task_notes || null,
      safety_notes: form.safety_notes || null,
      gap_tags: form.gap_tags,
    };
    try {
      if (!navigator.onLine) throw new Error("offline");
      await submit({ data: payload });
      toast.success("Daily log saved.");
      await qc.invalidateQueries({ queryKey: ["ct", "industry-roster"] });
    } catch (e) {
      if (!navigator.onLine || (e instanceof Error && e.message === "offline")) {
        await enqueueCtDailyLog(payload);
        await refreshCounts();
        toast.message("Saved on this device", { description: "It will be sent automatically when you are back online." });
      } else {
        toast.error(explainError(e).title, { description: explainError(e).solution });
        return;
      }
    }
    setForm((f) => ({ ...f, task_notes: "", safety_notes: "", gap_tags: [], safety_breach: false }));
  }

  const logsFor = (data?.logs ?? []).filter((l: any) => l.placement_id === active?.id).slice(0, 7);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight">Industry Trainer</h1>
            <p className="text-xs text-muted-foreground">Daily logs for your assigned trainees</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && <Badge variant="outline" className="gap-1"><CloudOff className="h-3 w-3" /> Offline</Badge>}
          {pending > 0 && <Badge variant="secondary">{pending} pending</Badge>}
          <Button variant="ghost" size="icon" onClick={() => void flush()} aria-label="Sync now">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          </Button>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your trainees…</p>
      ) : placements.length === 0 ? (
        <EmptyState title="No trainees assigned" description="Your enterprise has no active trainees yet. They appear here once the supervisor confirms a placement." />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Active trainees</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {placements.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setPlacementId(p.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    active?.id === p.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block font-medium">{p.students?.full_name ?? "Trainee"}</span>
                  <span className="block text-[11px] text-muted-foreground">{p.students?.registration_number ?? p.id.slice(0, 8)}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily log — {active?.students?.full_name ?? "Trainee"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="log-date">Date</Label>
                  <Input id="log-date" type="date" value={form.log_date}
                    onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hours">Shift hours</Label>
                  <Input id="hours" type="number" min={0} max={24} value={form.shift_hours}
                    onChange={(e) => setForm((f) => ({ ...f, shift_hours: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Attendance</Label>
                <div className="grid grid-cols-4 gap-2">
                  {ATTENDANCE.map((a) => (
                    <button key={a} onClick={() => setForm((f) => ({ ...f, attendance: a }))}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium",
                        form.attendance === a ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}>
                      {a.charAt(0) + a.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Performance today (1–5)</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} disabled={form.attendance === "ABSENT"}
                      onClick={() => setForm((f) => ({ ...f, score: String(n) }))}
                      className={cn(
                        "rounded-lg border py-3 text-sm font-semibold disabled:opacity-40",
                        Number(form.score) === n ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {tags.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Skill gaps observed</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t: any) => {
                      const selected = form.gap_tags.includes(t.name);
                      return (
                        <button key={t.id}
                          onClick={() => setForm((f) => ({
                            ...f,
                            gap_tags: selected ? f.gap_tags.filter((g) => g !== t.name) : [...f.gap_tags, t.name],
                          }))}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs",
                            selected ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground",
                          )}>
                          {t.name}{t.critical ? " ⚠" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <Label htmlFor="safety" className="text-sm">Critical safety breach</Label>
                  <p className="text-[11px] text-muted-foreground">Turning this on forces a red final status.</p>
                </div>
                <Switch id="safety" checked={form.safety_breach}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, safety_breach: v }))} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tasks">Tasks performed</Label>
                <Textarea id="tasks" rows={3} placeholder="e.g. Assisted with engine oil service on two vehicles"
                  value={form.task_notes} onChange={(e) => setForm((f) => ({ ...f, task_notes: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="safety-notes">Safety notes</Label>
                <Textarea id="safety-notes" rows={2} placeholder="e.g. PPE worn correctly all day"
                  value={form.safety_notes} onChange={(e) => setForm((f) => ({ ...f, safety_notes: e.target.value }))} />
              </div>

              <Button className="w-full" size="lg" onClick={() => void onSave()}>Save daily log</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent logs</CardTitle></CardHeader>
            <CardContent>
              {logsFor.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs recorded for this trainee yet.</p>
              ) : (
                <ul className="space-y-2">
                  {logsFor.map((l: any) => (
                    <li key={l.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <span>{l.log_date}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant={l.attendance === "PRESENT" ? "secondary" : "outline"}>{l.attendance}</Badge>
                        <span className="text-xs text-muted-foreground">{l.score ? `${l.score}/5` : "—"}</span>
                        {l.safety_breach && <Badge variant="destructive">Safety</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/industry")({
  head: () => ({
    meta: [
      { title: "Industry Trainer | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Record daily attendance, shift hours, performance scores and skill gaps for your assigned TVET trainees — works offline." },
      { property: "og:title", content: "Industry Trainer Daily Logs" },
      { property: "og:description", content: "Mobile-first daily logging for enterprise supervisors, with offline sync." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndustryTrainerApp,
});
