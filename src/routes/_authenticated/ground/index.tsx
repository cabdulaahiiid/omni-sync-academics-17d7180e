import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTrainerToday, getMyProgress, getServerTime } from "@/lib/trainer.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Layers, Eye, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/")({
  component: TrainerGround,
});

function TrainerGround() {
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me } = useMe();
  const canQuery = authReady && hasSession && !!userId && me?.userId === userId;
  const today = useServerFn(getTrainerToday);
  const progressFn = useServerFn(getMyProgress);
  const serverTimeFn = useServerFn(getServerTime);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const trainerRegistryId = me?.profile?.trainer_registry_id;
  useEffect(() => {
    if (!canQuery || !trainerRegistryId) return;
    const ch = supabase.channel(`trainer-schedules-${trainerRegistryId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "schedules", filter: `trainer_registry_id=eq.${trainerRegistryId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["trainer-today", userId] });
          qc.invalidateQueries({ queryKey: ["my-progress", userId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canQuery, trainerRegistryId, userId, qc]);
  const { data } = useQuery({
    queryKey: ["trainer-today", userId],
    queryFn: () => today(),
    enabled: canQuery, staleTime: 15000, throwOnError: false,
  });
  const { data: progress } = useQuery({
    queryKey: ["my-progress", userId],
    queryFn: () => progressFn(),
    enabled: canQuery, staleTime: 30000, throwOnError: false,
  });
  // Server-anchored clock so a wrong device clock can't unlock START early.
  const { data: srvTime } = useQuery({
    queryKey: ["server-time"],
    queryFn: async () => {
      const t0 = Date.now();
      const res = await serverTimeFn();
      const t1 = Date.now();
      const serverMs = new Date(res.now).getTime() + Math.round((t1 - t0) / 2);
      return { offsetMs: serverMs - t1 };
    },
    enabled: canQuery,
    refetchInterval: 60_000,
    staleTime: 60_000,
  });
  const offsetMs = srvTime?.offsetMs ?? 0;
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, []);
  const serverNow = tick + offsetMs;

  const sessions = data?.today ?? [];
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Today's Sessions</h1>
          <span className="rounded-full bg-[#123E7C]/10 px-2.5 py-0.5 text-xs font-semibold text-[#123E7C]">{sessions.length}</span>
        </div>
        <p className="text-sm text-slate-500">Progress {progress?.completed ?? 0} / {progress?.target ?? 15} sessions</p>
      </div>
      {sessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No sessions scheduled for today.</p>
        </div>
      )}
      <div className="space-y-3">
        {sessions.map((s: any) => (
          <SessionCard key={s.id} s={s} serverNow={serverNow} onStart={() => navigate({ to: "/ground/$scheduleId", params: { scheduleId: s.id } })} />
        ))}
      </div>
    </div>
  );
}

function SessionCard({ s, serverNow, onStart }: { s: any; serverNow: number; onStart: () => void }) {
  const startMs = s.date && s.start_time ? new Date(`${s.date}T${s.start_time}`).getTime() : 0;
  const unlockMs = startMs - 20 * 60_000;
  const canStart = serverNow >= unlockMs;
  const isEnded = s.status === "ENDED";
  const isLive = s.status === "ACTIVE" || s.status === "LIVE";
  const badge = isEnded
    ? { text: "Completed", cls: "bg-slate-200 text-slate-600" }
    : isLive
    ? { text: "Live", cls: "bg-[#16A34A]/15 text-[#16A34A]" }
    : canStart
    ? { text: "Ready", cls: "bg-[#F59E0B]/15 text-[#B45309]" }
    : { text: "Upcoming", cls: "bg-[#123E7C]/10 text-[#123E7C]" };

  function untilLabel() {
    const ms = Math.max(0, unlockMs - serverNow);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">{s.module_code}</span>
              <Badge className={`${badge.cls} border-0`}>{badge.text}</Badge>
            </div>
            <p className="mt-1 truncate text-base font-semibold text-slate-900">{s.module_name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</span>
              {s.venue_id && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Venue</span>}
              <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Section</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/ground/$scheduleId"
            params={{ scheduleId: s.id }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" /> View
          </Link>
          {canStart || isLive || isEnded ? (
            <Button
              onClick={onStart}
              className="h-12 rounded-xl bg-[#123E7C] text-sm font-semibold text-white shadow-sm hover:bg-[#0f356a]"
            >
              <Play className="mr-2 h-4 w-4" /> {isEnded ? "View Report" : isLive ? "Resume" : "Start Session"}
            </Button>
          ) : (
            <div className="flex h-12 flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <span className="text-[10px] uppercase tracking-wider">Available in</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-700">{untilLabel()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}