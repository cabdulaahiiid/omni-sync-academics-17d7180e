import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTrainerToday, getMyProgress, getTrainerSessionsDetailed } from "@/lib/trainer.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/")({
  component: TrainerGround,
});

function TrainerGround() {
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me } = useMe();
  const canQuery = authReady && hasSession && !!userId && me?.userId === userId;
  const today = useServerFn(getTrainerToday);
  const progressFn = useServerFn(getMyProgress);
  const detailedFn = useServerFn(getTrainerSessionsDetailed);
  const qc = useQueryClient();
  const [scope, setScope] = useState<"today" | "upcoming" | null>(null);
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
  const { data: detailRows, isLoading: detailLoading } = useQuery({
    queryKey: ["trainer-sessions-detailed", userId, scope],
    queryFn: () => detailedFn({ data: { scope: scope! } }),
    enabled: canQuery && !!scope,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground">Tap a session to start check-in.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setScope("today")} className="text-left">
          <Stat label="Today" value={data?.today.length ?? 0} />
        </button>
        <Stat label="Done" value={`${progress?.completed ?? 0}/${progress?.target ?? 15}`} />
        <button type="button" onClick={() => setScope("upcoming")} className="text-left">
          <Stat label="Upcoming" value={data?.total ?? 0} />
        </button>
      </div>
      <div className="space-y-2">
        {(data?.today ?? []).length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sessions scheduled for today.
          </p>
        )}
        {(data?.today ?? []).map((s: any) => (
          <Link key={s.id} to="/ground/$scheduleId" params={{ scheduleId: s.id }}
            className="block">
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{s.module_code} · {s.module_name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {s.start_time}–{s.end_time}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "LIVE" || s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Dialog open={!!scope} onOpenChange={(o) => !o && setScope(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{scope === "today" ? "Today's Sessions" : "Upcoming Sessions"}</DialogTitle>
          </DialogHeader>
          {detailLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!detailLoading && (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailRows ?? []).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</TableCell>
                      <TableCell><span className="font-mono text-xs">{r.module_code}</span> · {r.module_name}</TableCell>
                      <TableCell>{r.section_name}</TableCell>
                      <TableCell>{r.venue_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(detailRows ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sessions.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
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