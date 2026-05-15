import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrainerToday, getScheduleDetail } from "@/lib/trainer.functions";
import { enqueueSessionBatch } from "@/lib/offline/queue";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ground/")({
  component: TrainerGround,
});

function TrainerGround() {
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me } = useMe();
  const canQuery = authReady && hasSession && !!userId && me?.userId === userId;
  const today = useServerFn(getTrainerToday);
  const { data, refetch } = useQuery({
    queryKey: ["trainer-today", userId],
    queryFn: () => today(),
    enabled: canQuery,
    staleTime: 15000,
    throwOnError: false,
  });
  const [openSchedule, setOpenSchedule] = useState<string | null>(null);

  if (openSchedule) {
    return <CheckInFlow scheduleId={openSchedule} onBack={() => { setOpenSchedule(null); refetch(); }} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground">Tap a session to start check-in.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Today" value={data?.today.length ?? 0} />
        <Stat label="Done" value={data?.completed ?? 0} />
        <Stat label="Total" value={data?.total ?? 0} />
      </div>
      <div className="space-y-2">
        {(data?.today ?? []).length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sessions scheduled for today.
          </p>
        )}
        {(data?.today ?? []).map((s: any) => (
          <Card key={s.id} role="button" tabIndex={0} onClick={() => setOpenSchedule(s.id)}
                className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{s.module_code} · {s.module_name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {s.start_time}–{s.end_time}
                </p>
              </div>
              <Badge variant={s.status === "LIVE" ? "default" : "secondary"}>{s.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </CardContent></Card>
  );
}

function CheckInFlow({ scheduleId, onBack }: { scheduleId: string; onBack: () => void }) {
  const detailFn = useServerFn(getScheduleDetail);
  const { flush } = useOfflineSync();
  const { data, isLoading } = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () => detailFn({ data: { schedule_id: scheduleId } }),
    staleTime: 30000,
  });

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [lessonPlan, setLessonPlan] = useState("");
  const [outcome, setOutcome] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  function captureGeo() {
    if (!navigator.geolocation) { setGeoError("Geolocation unsupported"); return; }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    try {
      const attendance = Object.entries(presence).map(([student_id, present]) => ({ student_id, present }));
      await enqueueSessionBatch({
        client_uuid: crypto.randomUUID(),
        schedule_id: scheduleId,
        client_timestamp: new Date().toISOString(),
        lesson_plan: lessonPlan,
        learning_outcome: outcome,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        attendance,
      });
      toast.success("Queued for sync");
      const report = await flush();
      if (report) {
        if (report.applied) toast.success(`Submitted (${report.applied})`);
        if (report.conflicts) toast.warning(`${report.conflicts} conflict(s) — review banner`);
        if (report.rejected) toast.error(`${report.rejected} rejected — geo or window failed`);
      }
      onBack();
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !data) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const presentCount = Object.values(presence).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <h2 className="text-lg font-semibold">{data.schedule.module_code} · {data.schedule.module_name}</h2>
        <p className="text-xs text-muted-foreground">
          {data.schedule.date} · {data.schedule.start_time}–{data.schedule.end_time}
          {data.venue && <> · {data.venue.name}</>}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Geo check-in</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" onClick={captureGeo} className="w-full">
            <MapPin className="mr-2 h-4 w-4" /> {coords ? "Refresh location" : "Capture location"}
          </Button>
          {coords && (
            <p className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
          {geoError && <p className="text-xs text-destructive">{geoError}</p>}
          {data.venue && (
            <p className="text-[11px] text-muted-foreground">
              Venue radius: {data.venue.geo_radius}m · server validates on submit.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Attendance ({presentCount}/{data.students.length})</CardTitle>
          <button
            onClick={() => {
              const all = Object.fromEntries(data.students.map((s: any) => [s.id, true]));
              setPresence(all);
            }}
            className="text-xs text-primary"
          >Mark all</button>
        </CardHeader>
        <CardContent className="max-h-80 space-y-1 overflow-y-auto">
          {data.students.map((s: any) => (
            <label key={s.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent/40">
              <Checkbox
                checked={!!presence[s.id]}
                onCheckedChange={(v) => setPresence((p) => ({ ...p, [s.id]: !!v }))}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{s.registration_number}</p>
              </div>
            </label>
          ))}
          {data.students.length === 0 && (
            <p className="text-xs text-muted-foreground">No students assigned to this section.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lesson plan</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={lessonPlan} onChange={(e) => setLessonPlan(e.target.value)}
                    placeholder="What did you cover?" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Learning outcome</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)}
                    placeholder="What can students do now?" />
        </CardContent>
      </Card>

      <Button className="w-full" onClick={submit} disabled={submitting}>
        {submitting ? "Submitting…" : "Submit session"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Works offline — submissions queue and sync automatically.
      </p>
    </div>
  );
}