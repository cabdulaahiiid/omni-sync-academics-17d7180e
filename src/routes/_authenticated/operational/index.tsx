import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import { getDHStats, listDHSessionFeed, listPendingLeaves, decideLeaveRequest } from "@/lib/dh-ops.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, CalendarDays, CheckSquare, Activity, Plane } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operational/")({
  component: DHDashboard,
});

function DHDashboard() {
  const qc = useQueryClient();
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me } = useMe();
  const canQuery = authReady && hasSession && !!userId && me?.userId === userId
    && (me.roles.includes("DH") || me.roles.includes("MA"));

  const stats = useServerFn(getDHStats);
  const feed = useServerFn(listDHSessionFeed);
  const leaves = useServerFn(listPendingLeaves);
  const decide = useServerFn(decideLeaveRequest);

  const { data: kpi } = useQuery({ queryKey: ["dh-stats", userId], queryFn: () => stats(), enabled: canQuery, staleTime: 30000, throwOnError: false });
  const { data: feedRows } = useQuery({ queryKey: ["dh-feed", userId], queryFn: () => feed(), enabled: canQuery, staleTime: 15000, throwOnError: false });
  const { data: leaveRows } = useQuery({ queryKey: ["dh-leaves", userId], queryFn: () => leaves(), enabled: canQuery, staleTime: 30000, throwOnError: false });

  useEffect(() => {
    if (!canQuery) return;
    const ch = supabase.channel("dh-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["dh-feed"] });
        qc.invalidateQueries({ queryKey: ["dh-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["dh-leaves"] });
        qc.invalidateQueries({ queryKey: ["dh-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canQuery, qc]);

  const decideMut = useMutation({
    mutationFn: (v: { id: string; decision: "APPROVED" | "REJECTED" }) => decide({ data: v }),
    onSuccess: () => { toast.success("Decision saved"); qc.invalidateQueries({ queryKey: ["dh-leaves"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "Trainers", value: kpi?.trainers ?? 0, icon: Users },
    { label: "Students", value: kpi?.students ?? 0, icon: GraduationCap },
    { label: "Today's sessions", value: kpi?.todays_sessions ?? 0, icon: CalendarDays },
    { label: "Completed (7d)", value: kpi?.completed_7d ?? 0, icon: CheckSquare },
    { label: "Attendance %", value: `${kpi?.attendance_pct ?? 0}%`, icon: Activity },
    { label: "Leave requests", value: kpi?.pending_leaves ?? 0, icon: Plane },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Department Operations</h1>
        <p className="text-sm text-muted-foreground">Live monitoring for your department.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent submitted sessions</CardTitle></CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto">
            {!feedRows?.length && <p className="text-sm text-muted-foreground">No sessions submitted in the last 24h.</p>}
            {(feedRows ?? []).map((r: any) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.schedules?.module_code} · {r.schedules?.module_name}</p>
                  <Badge variant={r.geo_verified ? "default" : "destructive"} className="text-[10px]">
                    {r.geo_verified ? "Geo OK" : "Geo failed"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.schedules?.trainer_name} · {r.schedules?.date} · {new Date(r.submitted_at).toLocaleTimeString()}
                </p>
                {r.lesson_plan && <p className="mt-1 line-clamp-2 text-xs">{r.lesson_plan}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Pending leave requests</CardTitle></CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto">
            {!leaveRows?.length && <p className="text-sm text-muted-foreground">No pending leave requests.</p>}
            {(leaveRows ?? []).map((l: any) => (
              <div key={l.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{l.trainer_registry?.full_name}</p>
                <p className="text-xs text-muted-foreground">{l.start_date} → {l.end_date}</p>
                <p className="mt-1 text-xs">{l.reason}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => decideMut.mutate({ id: l.id, decision: "APPROVED" })} disabled={decideMut.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decideMut.mutate({ id: l.id, decision: "REJECTED" })} disabled={decideMut.isPending}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}