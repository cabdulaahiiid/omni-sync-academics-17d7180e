import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StepList, DetailTable, GeoRadar, type StepState } from "@/components/trainer/ui";
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

  // Build a report input snapshot for PDF generation.
  const buildReport = (): SessionReportInput | null => {
    if (!data) return null;
    return {
      schedule: data.schedule as SessionReportInput["schedule"],
      department: data.department,
      level: data.level,
      section: data.section,
      venue: data.venue,
      trainer: { full_name: me?.profile?.full_name ?? "" },
      session_number: data.session_number ?? null,
      target_sessions: (progress?.target ?? data.module?.total_sessions) ?? null,
      lesson_plan: lessonPlan,
      learning_outcome: outcome,
      students: data.students,
      presence,
    };
  };
  async function downloadReport() {
    const input = buildReport();
    if (!input) return;
    try {
      await generateSessionReportPdf(input);
      toast.success("Session report downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate report");
    }
  }

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
    onSuccess: async () => {
      toast.success("Session ended");
      qc.invalidateQueries({ queryKey: ["my-progress"] });
      qc.invalidateQueries({ queryKey: ["trainer-today"] });
      setStepOverride("done");
      refetch();
      // Auto-generate report on end.
      const input = buildReport();
      if (input) {
        try { await generateSessionReportPdf(input); } catch { /* user can retry from Done step */ }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-end at scheduled finish (server-anchored). Requires plan + outcome.
  const autoEndTriedRef = useRef(false);
  useEffect(() => {
    if (autoEndTriedRef.current) return;
    if (!endMs || isEnded) return;
    if (serverNow < endMs) return;
    if (lessonPlan.trim().length < 5 || outcome.trim().length < 5) return;
    if (!checkedIn) return;
    autoEndTriedRef.current = true;
    toast.message("Session time reached — ending automatically");
    endMut.mutate();
  }, [serverNow, endMs, isEnded, checkedIn, lessonPlan, outcome]);

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const presentCount = Object.values(presence).filter(Boolean).length;
  const absentCount = data.students.length - presentCount;
  const stepTitle: Record<Step, string> = {
    setup: "Pre-Class Preparation",
    checkin: "Session In Progress",
    roster: "Take Attendance",
    done: "Session Completed",
  };

  return (
    <div className="space-y-4">
      <div className="-mx-4 -mt-4 mb-1 flex items-center gap-3 bg-[#123E7C] px-4 py-3 text-white">
        <Link to="/ground" aria-label="Back" className="rounded-lg p-1 hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="flex-1 text-center text-[15px] font-semibold">{stepTitle[step]}</h2>
        <span className="w-7" />
      </div>

      <StepList
        steps={[
          { label: "Pre-Class Preparation", state: (step === "setup" ? "current" : "done") as StepState },
          { label: "Session Details", state: (step === "setup" ? "current" : "done") as StepState },
          { label: "Geo-fence Check", state: (step === "setup" ? "locked" : step === "checkin" ? "current" : "done") as StepState },
          { label: "Start Session", state: (step === "roster" ? "current" : step === "done" ? "done" : "locked") as StepState },
          { label: "Take Attendance", state: (step === "roster" ? "current" : step === "done" ? "done" : "locked") as StepState },
        ]}
      />

      {step === "setup" && (
        <SetupStep
          data={data}
          progress={progress}
          mode={mode}
          setMode={(m: Mode) => modeMut.mutate(m)}
          lessonPlan={lessonPlan} setLessonPlan={setLessonPlan}
          outcome={outcome} setOutcome={setOutcome}
          onProceed={() => setStepOverride("checkin")}
          geo={geo}
          geofenceEnabled={geofenceEnabled}
          bypass={bypass}
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
          sessionEndAt={endMs ? new Date(endMs).toISOString() : null}
          offsetMs={offsetMs}
          sessionDurationMs={endMs && startMs ? endMs - startMs : undefined}
          geofenceEnabled={geofenceEnabled}
          bypass={bypass}
          sync={sync}
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
          onDownloadReport={downloadReport}
          sync={sync}
        />
      )}
    </div>
  );
}

/* ---------------- Step 3: Context Setup ---------------- */
function SetupStep({ data, progress, mode, setMode, lessonPlan, setLessonPlan, outcome, setOutcome, onProceed, geo, geofenceEnabled, bypass }: any) {
  const s = data.schedule;
  const sessionNum = data.session_number ?? 1;
  const target = progress?.target ?? data.module?.total_sessions ?? 15;
  const geoBlocked = geofenceEnabled && !bypass && !geo?.inRadius;
  const ready = !!mode && lessonPlan.trim().length >= 5 && outcome.trim().length >= 5 && !geoBlocked;
  return (
    <>
      <p className="px-1 text-[13px] font-semibold text-[#123E7C]">Session Details</p>
      <DetailTable
        rows={[
          ["Department", data.department?.name ?? "—"],
          ["Level", data.level?.display_name ?? data.level?.name ?? "—"],
          ["Module Code", s.module_code],
          ["Module Name", s.module_name],
          ["Total Hours (Module)", `${data.module?.total_hours ?? "—"}`],
          ["Total Sessions (Module)", String(data.module?.total_sessions ?? target)],
          ["Session Number", `${sessionNum} of ${target}`],
          ["Venue", data.venue?.name ?? "—"],
          ["Session Start Time", String(s.start_time ?? "").slice(0, 5)],
          ["Session End Time", String(s.end_time ?? "").slice(0, 5)],
          ["Date", String(s.date ?? "—")],
        ]}
      />

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

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Geo-Fence Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={!geofenceEnabled ? "text-muted-foreground" : bypass ? "text-amber-600" : geo?.inRadius ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
              {!geofenceEnabled ? "Disabled (global)" : bypass ? "Bypassed" : geo?.inRadius ? "Verified · Inside campus" : "Outside campus"}
            </span>
          </div>
          {geo?.distance != null && geofenceEnabled && !bypass && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Distance</span>
              <span className={geo.inRadius ? "text-emerald-600" : "text-amber-600"}>{Math.round(geo.distance)}m</span>
            </div>
          )}
          {geo?.error && <p className="flex items-center gap-1 text-xs text-rose-600"><AlertTriangle className="h-3 w-3" />{geo.error}</p>}
          {geoBlocked && <p className="text-xs text-rose-600">You must be inside the campus geo-fence before starting teaching.</p>}
        </CardContent>
      </Card>

      <Button className="h-12 w-full text-base" disabled={!ready} onClick={onProceed}>
        {geoBlocked ? "Outside geo-fence — cannot proceed" : "Proceed to Check-In"}
      </Button>
    </>
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
          <GeoRadar ok={!geofenceEnabled || bypass || !!geo?.inRadius} />
          <p className="text-center text-[13px] font-semibold text-slate-900">
            {!geofenceEnabled ? "Geo-fence disabled" : bypass ? "Geo-fence bypassed" : geo?.inRadius ? "Geo-fence Passed" : "You are outside the allowed area"}
          </p>
          {geo?.coords && (
            <p className="text-center text-[11px] text-slate-500">Accuracy: {Math.round(geo.coords.accuracy)}m</p>
          )}
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
  onSubmit, canEnd, ending, onEnd, lessonPlan, setLessonPlan, outcome, setOutcome,
  sessionEndAt, offsetMs, sessionDurationMs, geofenceEnabled, bypass, sync }: any) {
  const setPresent = (id: string, val: boolean) => setPresence((p: any) => ({ ...p, [id]: val }));
  const [query, setQuery] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const visible = data.students.filter((s: any) =>
    !query.trim() ||
    String(s.full_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
    String(s.registration_number ?? "").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="space-y-3 p-4">
          {sessionEndAt && (
            <CountdownTimer
              until={sessionEndAt}
              label="Session ends in"
              variant="ring"
              offsetMs={offsetMs ?? 0}
              totalMs={sessionDurationMs}
            />
          )}
          {rosterUntil && <CountdownTimer until={rosterUntil} label="Attendance window remaining" />}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Geo-fence</p>
              <p className={!geofenceEnabled ? "text-muted-foreground" : bypass ? "text-amber-600 font-medium" : geo?.inRadius ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                ● {!geofenceEnabled ? "Disabled" : bypass ? "Bypassed" : geo?.inRadius ? "On campus" : "Outside"}
                {geo?.distance != null && geofenceEnabled && !bypass && (
                  <span className="ml-1 text-muted-foreground">({Math.round(geo.distance)}m)</span>
                )}
              </p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sync</p>
              <p className={sync?.online ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                {sync?.online ? <Wifi className="mr-1 inline h-3 w-3" /> : <WifiOff className="mr-1 inline h-3 w-3" />}
                {sync?.online ? "Online" : "Offline"}
                {sync?.pending > 0 && (
                  <span className="ml-1 text-muted-foreground">· {sync.pending} pending</span>
                )}
                {sync?.syncing && <RefreshCw className="ml-1 inline h-3 w-3 animate-spin" />}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3">
            <Input
              placeholder="Search students…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 flex-1 bg-white text-[13px]"
            />
            <button
              type="button"
              disabled={isEnded}
              onClick={() => setPresence(Object.fromEntries(data.students.map((s: any) => [s.id, true])))}
              className="whitespace-nowrap text-[12px] font-semibold text-[#123E7C] disabled:text-slate-300"
            >
              Select All
            </button>
          </div>
          <div className="max-h-[46vh] divide-y divide-slate-100 overflow-y-auto">
            {visible.map((s: any, i: number) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-[12px] text-slate-400">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-900">{s.full_name}</p>
                  <p className="text-[11px] text-slate-500">{s.registration_number}</p>
                </div>
                <Checkbox
                  checked={presence[s.id] === true}
                  disabled={isEnded}
                  onCheckedChange={(v) => setPresent(s.id, v === true)}
                />
              </label>
            ))}
            {visible.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">No students found.</p>}
          </div>
          <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#16A34A]" /> Present {presentCount}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#DC2626]" /> Absent {data.students.length - presentCount}</span>
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

      <Button variant="destructive" className="h-11 w-full" disabled={isEnded || ending || !canEnd} onClick={() => setConfirmEnd(true)}>
        <StopCircle className="mr-2 h-4 w-4" />
        {ending ? "Ending…" : "End Session"}
      </Button>
      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">End Session</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to end this session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl bg-slate-50 p-3 text-[12px] text-slate-600">
            <p className="mb-1 font-medium text-slate-700">This action will:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>Complete the session</li>
              <li>Save all records</li>
              <li>Generate final report</li>
            </ul>
          </div>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={onEnd}
              className="h-11 w-full rounded-xl bg-[#DC2626] text-white hover:bg-[#b91c1c]"
            >
              Yes, End Session
            </AlertDialogAction>
            <AlertDialogCancel className="h-11 w-full rounded-xl border-[#123E7C] text-[#123E7C]">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!canEnd && <p className="text-center text-[11px] text-muted-foreground">Plan + outcome must be ≥ 5 chars to end.</p>}
    </>
  );
}

/* ---------------- Step 6: Session Completed ---------------- */
function DoneStep({ data, presentCount, absentCount, lessonPlan, onHome, onDownloadReport, sync }: any) {
  const s = data.schedule;
  const sessionNum = data.session_number ?? "—";
  const pct = data.students.length ? Math.round((presentCount / data.students.length) * 100) : 0;
  const checklist = [
    "Attendance Saved",
    "Session Report Generated",
    "PDF Created",
    sync?.online && sync?.pending === 0 ? "Synced with ERP" : sync?.online ? "Syncing with ERP…" : "Queued for sync (offline)",
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
      <Button className="h-12 w-full rounded-2xl bg-[#16A34A] text-base hover:bg-[#128a3d]" onClick={onDownloadReport}>
        <Download className="mr-2 h-4 w-4" /> Download Session Report (PDF)
      </Button>
      <Button className="h-12 w-full rounded-2xl bg-[#123E7C] text-base hover:bg-[#0f356a]" onClick={onHome}>
        <Home className="mr-2 h-4 w-4" /> Home
      </Button>
    </>
  );
}