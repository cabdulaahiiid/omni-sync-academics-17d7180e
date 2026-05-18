import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getScheduleDetail, setSessionMode, trainerCheckIn, trainerEndSession, getMyProgress,
} from "@/lib/trainer.functions";
import { enqueueSessionBatch } from "@/lib/offline/queue";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useGeoGatekeeper } from "@/hooks/use-geo-gatekeeper";
import { useQuery as useQueryCore } from "@tanstack/react-query";
import { useServerFn as useServerFnCore } from "@tanstack/react-start";
import { getGlobalConfig } from "@/lib/global-config.functions";
import { useMe } from "@/hooks/use-me";
import { CountdownTimer } from "@/components/countdown-timer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, CheckCircle2, AlertTriangle, PlayCircle, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ground/$scheduleId")({
  component: SessionDetail,
});

const MODES = ["Theory", "Practical", "Both"] as const;

function SessionDetail() {
  const { scheduleId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getScheduleDetail);
  const setMode = useServerFn(setSessionMode);
  const checkInFn = useServerFn(trainerCheckIn);
  const endFn = useServerFn(trainerEndSession);
  const progressFn = useServerFn(getMyProgress);
  const { flush } = useOfflineSync();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () => detailFn({ data: { schedule_id: scheduleId } }),
    staleTime: 15000,
  });
  const { data: progress } = useQuery({ queryKey: ["my-progress"], queryFn: () => progressFn(), staleTime: 30000 });

  const cfgFn = useServerFnCore(getGlobalConfig);
  const { data: cfg } = useQueryCore({ queryKey: ["global-config"], queryFn: () => cfgFn(), staleTime: 60000 });
  const { data: me } = useMe();
  const bypass = !!me?.profile?.bypass_geofence;
  const campusTarget = cfg?.campus_lat != null && cfg?.campus_lng != null
    ? { latitude: cfg.campus_lat, longitude: cfg.campus_lng, geo_radius: cfg.campus_radius_m ?? 150 }
    : data?.venue;
  const geo = useGeoGatekeeper(campusTarget, true, { minRadius: 150, bypass });

  // 10-min pre-start to 20-min post-start activation window
  const startMs = data?.schedule?.date && data?.schedule?.start_time
    ? new Date(`${data.schedule.date}T${data.schedule.start_time}`).getTime() : 0;
  const endMs = data?.schedule?.date && data?.schedule?.end_time
    ? new Date(`${data.schedule.date}T${data.schedule.end_time}`).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const canStart = startMs && now >= startMs - 10 * 60000 && now <= startMs + 20 * 60000;
  const rosterPromptStart = endMs - 10 * 60000;
  // Vibrate once when the check-out window opens
  const [vibrated, setVibrated] = useState(false);
  useEffect(() => {
    if (!vibrated && endMs && now >= rosterPromptStart && now < endMs && "vibrate" in navigator) {
      try { (navigator as any).vibrate?.([200, 100, 200]); } catch { /* ignore */ }
      setVibrated(true);
    }
  }, [now, endMs, rosterPromptStart, vibrated]);
  const [mode, setLocalMode] = useState<typeof MODES[number] | null>(null);
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [rosterUntil, setRosterUntil] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [lessonPlan, setLessonPlan] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    if (!data) return;
    const p: Record<string, boolean> = {};
    for (const s of data.students) p[s.id] = false;
    for (const a of data.existingAttendance) p[a.student_id] = !!a.present;
    setPresence(p);
    if (data.existingLog) {
      setLessonPlan(data.existingLog.lesson_plan ?? "");
      setOutcome(data.existingLog.learning_outcome ?? "");
    }
  }, [data]);

  const modeMut = useMutation({
    mutationFn: (m: typeof MODES[number]) => setMode({ data: { schedule_id: scheduleId, mode: m } }),
    onSuccess: (_d, m) => { setLocalMode(m); toast.success(`Mode: ${m}`); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkInMut = useMutation({
    mutationFn: () =>
      checkInFn({ data: { schedule_id: scheduleId, latitude: geo.coords!.lat, longitude: geo.coords!.lng } }),
    onSuccess: (res) => {
      setCheckInAt(res.checkin_at);
      setRosterUntil(res.roster_unlock_until);
      toast.success("Checked in. Roster unlocked for 50 minutes.");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function submitRoster() {
    if (!data) return;
    const attendance = Object.entries(presence).map(([student_id, present]) => ({ student_id, present }));
    await enqueueSessionBatch({
      client_uuid: crypto.randomUUID(),
      schedule_id: scheduleId,
      client_timestamp: new Date().toISOString(),
      lesson_plan: lessonPlan,
      learning_outcome: outcome,
      latitude: geo.coords?.lat ?? null,
      longitude: geo.coords?.lng ?? null,
      attendance,
    });
    toast.success("Roster queued");
    const rep = await flush();
    if (rep?.applied) toast.success(`Synced (${rep.applied})`);
    if (rep?.rejected) toast.error(`${rep.rejected} rejected`);
  }

  const endMut = useMutation({
    mutationFn: () =>
      endFn({ data: { schedule_id: scheduleId, learning_outcome: outcome, lesson_plan: lessonPlan } }),
    onSuccess: () => {
      toast.success("Session ended");
      qc.invalidateQueries({ queryKey: ["my-progress"] });
      qc.invalidateQueries({ queryKey: ["trainer-today"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const status = (data.schedule as any).status as string;
  const isEnded = status === "ENDED";
  const checkedIn = !!checkInAt || status === "ACTIVE";
  const presentCount = Object.values(presence).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Link to="/ground" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to schedule
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{data.schedule.module_code} · {data.schedule.module_name}</h2>
        <p className="text-xs text-muted-foreground">
          {data.schedule.date} · {data.schedule.start_time}–{data.schedule.end_time}
          {data.venue && <> · {data.venue.name}</>}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline">{status}</Badge>
          {progress && (
            <Badge variant="secondary" className="text-xs">
              Progress: {progress.completed} / {progress.target}
            </Badge>
          )}
        </div>
      </div>

      {/* Mode selector */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Session mode</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Button key={m} size="sm" variant={mode === m ? "default" : "outline"}
              disabled={isEnded || modeMut.isPending}
              onClick={() => modeMut.mutate(m)}>{m}</Button>
          ))}
        </CardContent>
      </Card>

      {/* Geo + Check-In */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Check-in (30-minute / 200m gatekeeper)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {geo.error && <p className="flex items-center gap-1 text-xs text-rose"><AlertTriangle className="h-3 w-3" />{geo.error}</p>}
          {geo.coords && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)} (±{Math.round(geo.coords.accuracy)}m)
            </p>
          )}
          {geo.distance != null && (
            <p className={`text-xs ${geo.inRadius ? "text-emerald" : "text-amber"}`}>
              Distance to venue: {Math.round(geo.distance)}m {geo.inRadius ? "✓ inside" : "(outside)"}
            </p>
          )}
          <Button className="w-full" disabled={!canStart || !geo.inRadius || checkInMut.isPending || checkedIn || isEnded}
            onClick={() => checkInMut.mutate()}>
            <PlayCircle className="mr-2 h-4 w-4" />
            {checkedIn ? "Checked in" : !canStart ? "Outside check-in window" : checkInMut.isPending ? "Checking in…" : "Start session"}
          </Button>
          {rosterUntil && <CountdownTimer until={rosterUntil} label="Roster window" />}
        </CardContent>
      </Card>

      {/* Roster */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Attendance ({presentCount}/{data.students.length})</CardTitle>
          <button onClick={() => setPresence(Object.fromEntries(data.students.map((s: any) => [s.id, true])))}
            className="text-xs text-primary">Mark all</button>
        </CardHeader>
        <CardContent className="max-h-72 space-y-1 overflow-y-auto">
          {data.students.map((s: any) => (
            <label key={s.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/40">
              <Checkbox checked={!!presence[s.id]} disabled={!checkedIn || isEnded}
                onCheckedChange={(v) => setPresence((p) => ({ ...p, [s.id]: !!v }))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{s.registration_number}</p>
              </div>
            </label>
          ))}
          {data.students.length === 0 && <p className="text-xs text-muted-foreground">No students assigned.</p>}
        </CardContent>
        <CardContent className="pt-0">
          <Button variant="secondary" size="sm" className="w-full" disabled={!checkedIn || isEnded}
            onClick={submitRoster}>Submit roster</Button>
        </CardContent>
      </Card>

      {/* LO + Plan */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lesson plan (required ≥ 5 chars)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={lessonPlan} disabled={isEnded}
            onChange={(e) => setLessonPlan(e.target.value)}
            placeholder="What did you cover today?" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Learning outcome (required ≥ 5 chars)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={outcome} disabled={isEnded}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder="What can students do now?" />
        </CardContent>
      </Card>

      <Button className="w-full" variant="destructive" disabled={isEnded || endMut.isPending || lessonPlan.trim().length < 5 || outcome.trim().length < 5}
        onClick={() => endMut.mutate()}>
        <StopCircle className="mr-2 h-4 w-4" />
        {isEnded ? "Session ended" : endMut.isPending ? "Ending…" : "End session"}
      </Button>
      {isEnded && <p className="flex items-center justify-center gap-1 text-xs text-emerald">
        <CheckCircle2 className="h-3 w-3" /> Locked. Attendance overrides allowed for 24h via DH.
      </p>}
    </div>
  );
}