import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getScheduleDetail, setSessionMode, trainerCheckIn, trainerEndSession, getMyProgress, getServerTime,
} from "@/lib/trainer.functions";
import { enqueueSessionBatch } from "@/lib/offline/queue";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useGeoGatekeeper } from "@/hooks/use-geo-gatekeeper";
import { getGlobalConfig } from "@/lib/global-config.functions";
import { useMe } from "@/hooks/use-me";
import { CountdownTimer } from "@/components/countdown-timer";
import { generateSessionReportPdf, type SessionReportInput } from "@/lib/session-report-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, CheckCircle2, AlertTriangle, StopCircle, Home, Download, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ground/$scheduleId")({
  component: SessionDetail,
});

const MODES = ["Theory", "Practical", "Both"] as const;
type Mode = typeof MODES[number];
type Step = "setup" | "checkin" | "roster" | "done";

function SessionDetail() {
  const { scheduleId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detailFn = useServerFn(getScheduleDetail);
  const setMode = useServerFn(setSessionMode);
  const checkInFn = useServerFn(trainerCheckIn);
  const endFn = useServerFn(trainerEndSession);
  const progressFn = useServerFn(getMyProgress);
  const cfgFn = useServerFn(getGlobalConfig);
  const serverTimeFn = useServerFn(getServerTime);
  const { flush } = useOfflineSync();
  const { data: me } = useMe();
  const sync = useOfflineSync();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () => detailFn({ data: { schedule_id: scheduleId } }),
    staleTime: 15000,
  });
  const { data: progress } = useQuery({ queryKey: ["my-progress"], queryFn: () => progressFn(), staleTime: 30000 });
  const { data: cfg } = useQuery({ queryKey: ["global-config"], queryFn: () => cfgFn(), staleTime: 60000 });

  // Server-anchored clock: compute drift offset, refresh every 60s.
  const { data: srvTime } = useQuery({
    queryKey: ["server-time"],
    queryFn: async () => {
      const t0 = Date.now();
      const res = await serverTimeFn();
      const t1 = Date.now();
      const serverMs = new Date(res.now).getTime() + Math.round((t1 - t0) / 2);
      return { offsetMs: serverMs - t1 };
    },
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const offsetMs = srvTime?.offsetMs ?? 0;

  const bypass = !!me?.profile?.bypass_geofence;
  const geofenceEnabled = cfg?.geofence_enabled !== false;
  const campusTarget = cfg?.campus_lat != null && cfg?.campus_lng != null
    ? { latitude: cfg.campus_lat, longitude: cfg.campus_lng, geo_radius: cfg.campus_radius_m ?? 150 }
    : data?.venue;
  const geoInactive = bypass || !geofenceEnabled;
  const geo = useGeoGatekeeper(campusTarget, !geoInactive, { minRadius: 150, bypass: geoInactive });

  const startMs = data?.schedule?.date && data?.schedule?.start_time
    ? new Date(`${data.schedule.date}T${data.schedule.start_time}`).getTime() : 0;
  const endMs = data?.schedule?.date && data?.schedule?.end_time
    ? new Date(`${data.schedule.date}T${data.schedule.end_time}`).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  // Server-anchored "now" so a wrong device clock cannot shift the window.
  const serverNow = now + offsetMs;
  // Attendance window = last 10 minutes of the session.
  const windowOpenMs = endMs ? endMs - 10 * 60_000 : 0;
  const windowCloseMs = endMs;
  const canStart = !!endMs && serverNow >= windowOpenMs && serverNow <= windowCloseMs;

  const [mode, setLocalMode] = useState<Mode | "">("");
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [rosterUntil, setRosterUntil] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [lessonPlan, setLessonPlan] = useState("");
  const [outcome, setOutcome] = useState("");
  const [stepOverride, setStepOverride] = useState<Step | null>(null);

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
    if ((data.schedule as any).mode) setLocalMode((data.schedule as any).mode as Mode);
    if ((data.schedule as any).checkin_at) setCheckInAt((data.schedule as any).checkin_at);
  }, [data]);

  const status = (data?.schedule as any)?.status as string | undefined;
  const isEnded = status === "ENDED";
  const checkedIn = !!checkInAt || status === "ACTIVE";

  // Derive current step
  const step: Step = useMemo(() => {
    if (stepOverride) return stepOverride;
    if (isEnded) return "done";
    if (checkedIn) return "roster";
    if (mode && lessonPlan.trim().length >= 5 && outcome.trim().length >= 5) return "checkin";
    return "setup";
  }, [stepOverride, isEnded, checkedIn, mode, lessonPlan, outcome]);

  const modeMut = useMutation({
    mutationFn: (m: Mode) => setMode({ data: { schedule_id: scheduleId, mode: m } }),
    onSuccess: (_d, m) => { setLocalMode(m); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkInMut = useMutation({
    mutationFn: () =>
      checkInFn({ data: {
        schedule_id: scheduleId,
        latitude: geo.coords?.lat ?? 0,
        longitude: geo.coords?.lng ?? 0,
      } }),
    onSuccess: (res) => {
      setCheckInAt(res.checkin_at);
      setRosterUntil(res.roster_unlock_until);
      toast.success("Checked in. Attendance window open.");
      setStepOverride("roster");
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
    toast.success("Attendance submitted");
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
      setStepOverride("done");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const presentCount = Object.values(presence).filter(Boolean).length;
  const absentCount = data.students.length - presentCount;
  const stepTitle: Record<Step, string> = {
    setup: "Context Setup",
    checkin: "Session Started",
    roster: "Attendance",
    done: "Session Completed",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/ground" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h2 className="text-sm font-semibold">{stepTitle[step]}</h2>
        <div className="w-12" />
      </div>

      {step === "setup" && (
        <SetupStep
          data={data}
          progress={progress}
          mode={mode}
          setMode={(m: Mode) => modeMut.mutate(m)}
          lessonPlan={lessonPlan} setLessonPlan={setLessonPlan}
          outcome={outcome} setOutcome={setOutcome}
          onProceed={() => setStepOverride("checkin")}
        />
      )}

      {step === "checkin" && (
        <CheckInStep
          serverNow={serverNow}
          offsetMs={offsetMs}
          windowOpenMs={windowOpenMs}
          windowCloseMs={windowCloseMs}
          canStart={canStart}
          geo={geo}
          geofenceEnabled={geofenceEnabled}
          bypass={bypass}
          checking={checkInMut.isPending}
          onCheckIn={() => checkInMut.mutate()}
          onBack={() => setStepOverride("setup")}
        />
      )}

      {step === "roster" && (
        <RosterStep
          data={data}
          presence={presence}
          setPresence={setPresence}
          presentCount={presentCount}
          geo={geo}
          rosterUntil={rosterUntil ?? (data.schedule as any).checkin_at ? new Date(new Date((data.schedule as any).checkin_at).getTime() + 50 * 60000).toISOString() : null}
          isEnded={isEnded}
          submitting={false}
          onSubmit={submitRoster}
          canEnd={lessonPlan.trim().length >= 5 && outcome.trim().length >= 5}
          ending={endMut.isPending}
          onEnd={() => endMut.mutate()}
          lessonPlan={lessonPlan} setLessonPlan={setLessonPlan}
          outcome={outcome} setOutcome={setOutcome}
        />
      )}

      {step === "done" && (
        <DoneStep
          data={data}
          presentCount={presentCount}
          absentCount={absentCount}
          lessonPlan={lessonPlan}
          outcome={outcome}
          onHome={() => navigate({ to: "/ground" })}
        />
      )}
    </div>
  );
}

/* ---------------- Step 3: Context Setup ---------------- */
function SetupStep({ data, progress, mode, setMode, lessonPlan, setLessonPlan, outcome, setOutcome, onProceed }: any) {
  const s = data.schedule;
  const sessionNum = data.session_number ?? 1;
  const target = progress?.target ?? data.module?.total_sessions ?? 15;
  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">System Data (Read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Dept" value={data.department?.name ?? "—"} />
          <Row label="Level" value={data.level?.display_name ?? data.level?.name ?? "—"} />
          <Row label="UC/Module" value={s.module_name} />
          <Row label="Module Code" value={s.module_code} />
          <Row label="Total Hrs" value={`${data.module?.total_hours ?? "—"} Hr`} inline />
          <Row label="Total Sessions" value={String(data.module?.total_sessions ?? target)} inline />
          <Row label="Session" value={`${sessionNum} of ${target}`} />
          <Row label="Venue" value={data.venue?.name ?? "—"} />
          <Row label="When" value={`${s.date} · ${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)}`} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Manual Entry (Required)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Mode</label>
            <Select value={mode || undefined} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Session Plan</label>
            <Textarea rows={3} value={lessonPlan} onChange={(e) => setLessonPlan(e.target.value)}
              placeholder="Install wiring circuits…" />
            <p className="mt-1 text-[11px] text-muted-foreground">Min 5 characters.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Learning Outcome</label>
            <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)}
              placeholder="Wiring safety procedures…" />
            <p className="mt-1 text-[11px] text-muted-foreground">Min 5 characters.</p>
          </div>
        </CardContent>
      </Card>

      <Button className="h-12 w-full text-base" disabled={!mode || lessonPlan.trim().length < 5 || outcome.trim().length < 5}
        onClick={onProceed}>
        Proceed to Check-In
      </Button>
    </>
  );
}

function Row({ label, value, inline }: { label: string; value: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ---------------- Step 4: Session Started / Check-In ---------------- */
function CheckInStep({ serverNow, offsetMs, windowOpenMs, windowCloseMs, canStart, geo, geofenceEnabled, bypass, checking, onCheckIn, onBack }: any) {
  // Ring target: counts down to window open, then to window close.
  const target = useMemo(() => {
    if (!windowCloseMs) return null;
    if (serverNow < windowOpenMs) return new Date(windowOpenMs).toISOString();
    return new Date(windowCloseMs).toISOString();
  }, [serverNow, windowOpenMs, windowCloseMs]);
  const beforeOpen = serverNow < windowOpenMs;
  const afterClose = serverNow > windowCloseMs;
  const windowLabel = beforeOpen ? "until window opens" : afterClose ? "window closed" : "to check in";
  // Ring fill: beforeOpen fills against a 10-min countdown; once open, against the 10-min window.
  const ringTotalMs = 10 * 60_000;

  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="space-y-4 p-6">
          <CountdownTimer until={target} label={windowLabel} variant="ring" offsetMs={offsetMs} totalMs={ringTotalMs} />
          <p className="text-center text-xs text-muted-foreground">Attendance window: last 10 minutes of the session</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">System Overview</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Geo-Fence check</span>
            <span className={!geofenceEnabled ? "text-muted-foreground" : bypass ? "text-amber" : geo.inRadius ? "text-emerald font-medium" : "text-rose"}>
              {!geofenceEnabled ? "Disabled (global)" : bypass ? "Bypassed" : geo.inRadius ? "Active · Inside" : "Outside"}
            </span>
          </div>
          {geo.coords && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />GPS</span>
              <span>{geo.coords.lat.toFixed(5)}, {geo.coords.lng.toFixed(5)} ±{Math.round(geo.coords.accuracy)}m</span>
            </div>
          )}
          {geo.distance != null && geofenceEnabled && !bypass && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Distance to venue</span>
              <span className={geo.inRadius ? "text-emerald" : "text-amber"}>{Math.round(geo.distance)}m</span>
            </div>
          )}
          {geo.error && <p className="flex items-center gap-1 text-xs text-rose"><AlertTriangle className="h-3 w-3" />{geo.error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="h-12 w-full text-base"
          disabled={!canStart || (geofenceEnabled && !bypass && !geo.inRadius) || checking}
          onClick={onCheckIn}>
          <MapPin className="mr-2 h-4 w-4" />
          {checking ? "Checking in…" : beforeOpen ? "Check-in opens in last 10 min" : afterClose ? "Check-in window closed" : "Check-In Location"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onBack}>Back to setup</Button>
      </div>
    </>
  );
}

/* ---------------- Step 5: Active Attendance ---------------- */
function RosterStep({ data, presence, setPresence, presentCount, geo, rosterUntil, isEnded,
  onSubmit, canEnd, ending, onEnd, lessonPlan, setLessonPlan, outcome, setOutcome }: any) {
  const setPresent = (id: string, val: boolean) => setPresence((p: any) => ({ ...p, [id]: val }));
  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="space-y-2 p-4">
          {rosterUntil && <CountdownTimer until={rosterUntil} label="Attendance window remaining" />}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">GPS status</span>
            <span className={geo.inRadius ? "text-emerald font-medium" : "text-amber font-medium"}>
              ● {geo.inRadius ? "On Campus" : "Outside"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Students ({presentCount}/{data.students.length})</CardTitle>
          <button onClick={() => setPresence(Object.fromEntries(data.students.map((s: any) => [s.id, true])))}
            className="text-xs font-medium text-primary">Mark all present</button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Student</span><span>Present</span><span>Absent</span>
          </div>
          <div className="max-h-[50vh] divide-y overflow-y-auto">
            {data.students.map((s: any) => (
              <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{s.registration_number}</p>
                </div>
                <Checkbox checked={presence[s.id] === true} disabled={isEnded}
                  onCheckedChange={() => setPresent(s.id, true)} />
                <Checkbox checked={presence[s.id] === false} disabled={isEnded}
                  onCheckedChange={() => setPresent(s.id, false)} />
              </div>
            ))}
            {data.students.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">No students assigned.</p>}
          </div>
        </CardContent>
      </Card>

      <Button onClick={onSubmit} disabled={isEnded} className="h-11 w-full bg-emerald text-white hover:bg-emerald/90">
        Submit Attendance
      </Button>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lesson plan</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={2} value={lessonPlan} disabled={isEnded} onChange={(e) => setLessonPlan(e.target.value)} />
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Learning outcome</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={2} value={outcome} disabled={isEnded} onChange={(e) => setOutcome(e.target.value)} />
        </CardContent>
      </Card>

      <Button variant="destructive" className="h-11 w-full" disabled={isEnded || ending || !canEnd} onClick={onEnd}>
        <StopCircle className="mr-2 h-4 w-4" />
        {ending ? "Ending…" : "End Session"}
      </Button>
      {!canEnd && <p className="text-center text-[11px] text-muted-foreground">Plan + outcome must be ≥ 5 chars to end.</p>}
    </>
  );
}

/* ---------------- Step 6: Session Completed ---------------- */
function DoneStep({ data, presentCount, absentCount, lessonPlan, onHome }: any) {
  const s = data.schedule;
  const sessionNum = data.session_number ?? "—";
  const pct = data.students.length ? Math.round((presentCount / data.students.length) * 100) : 0;
  const checklist = [
    "Attendance Saved",
    "Session Report Generated",
    "PDF Created",
    "Synced with ERP",
    "Department Head Notified",
    "Student Attendance Updated",
    "Session Archived",
  ];
  return (
    <>
      <div className="flex flex-col items-center py-6">
        <div className="grid h-24 w-24 animate-pulse place-items-center rounded-full bg-[#16A34A]/15 text-[#16A34A]">
          <CheckCircle2 className="h-14 w-14" />
        </div>
        <p className="mt-4 text-xl font-bold text-slate-900">Session Successfully Completed</p>
        <p className="text-sm text-slate-500">Session {sessionNum} · {s.module_name}</p>
      </div>
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="grid grid-cols-3 gap-3 p-4 text-center">
          <div><p className="text-xs text-slate-500">Present</p><p className="text-2xl font-bold text-[#16A34A]">{presentCount}</p></div>
          <div><p className="text-xs text-slate-500">Absent</p><p className="text-2xl font-bold text-[#DC2626]">{absentCount}</p></div>
          <div><p className="text-xs text-slate-500">Attendance</p><p className="text-2xl font-bold text-[#123E7C]">{pct}%</p></div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="space-y-2 p-4">
          {checklist.map((c) => (
            <div key={c} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" /> {c}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Lesson Plan</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{lessonPlan || "—"}</p>
        </CardContent>
      </Card>
      <Button className="h-12 w-full rounded-2xl bg-[#123E7C] text-base hover:bg-[#0f356a]" onClick={onHome}>
        <Home className="mr-2 h-4 w-4" /> Home
      </Button>
    </>
  );
}