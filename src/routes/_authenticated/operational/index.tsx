import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ApprovalActions } from "@/components/erp/approval-actions";
import { Activity, CalendarDays, AlertTriangle, Plane, ArrowLeftRight, ChevronRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    mutationFn: (v: { id: string; decision: "APPROVED" | "REJECTED"; reason?: string }) =>
      decide({ data: { id: v.id, decision: v.decision } }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === "APPROVED" ? "Leave approved" : "Leave rejected — trainer will be notified");
      qc.invalidateQueries({ queryKey: ["dh-leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const heroCards = [
    { label: "Today's Sessions", value: `${kpi?.todays_sessions ?? 0} Active Classes` },
    { label: "Attendance Rate", value: `${kpi?.attendance_pct ?? 0}%` },
    { label: "Trainer Compliance", value: `${kpi?.completed_7d ?? 0} Sessions` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Department Head</h1>
        <p className="text-sm text-muted-foreground">Department head dashboard</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {heroCards.map((c) => (
          <Card key={c.label} className="rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="mt-2 text-2xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Schedule Overview</CardTitle>
            <Badge variant="outline" className="rounded-lg text-xs">Live view</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-12 border-y bg-muted/40 px-6 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <div className="col-span-3">Date</div>
              <div className="col-span-4">Trainer</div>
              <div className="col-span-3">Time</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y">
              {!feedRows?.length && <p className="px-6 py-6 text-sm text-muted-foreground">No sessions submitted yet.</p>}
              {(feedRows ?? []).slice(0, 8).map((r: any) => (
                <div key={r.id} className="grid grid-cols-12 items-center px-6 py-3 text-sm">
                  <div className="col-span-3">
                    <p className="font-medium">{r.schedules?.module_code ?? "Session"}</p>
                    <p className="text-xs text-muted-foreground">{r.schedules?.date ?? new Date(r.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="col-span-4 truncate text-muted-foreground">{r.schedules?.trainer_name ?? r.schedules?.module_name ?? "—"}</div>
                  <div className="col-span-3 text-muted-foreground">{r.schedules?.start_time ?? ""}{r.schedules?.end_time ? ` – ${r.schedules.end_time}` : ""}</div>
                  <div className="col-span-2 text-right">
                    <Badge className={cn(
                      "rounded-lg text-[10px]",
                      r.geo_verified
                        ? "bg-emerald text-emerald-fg hover:bg-emerald"
                        : "bg-amber text-amber-fg hover:bg-amber",
                    )}>
                      {r.geo_verified ? "Live" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Live Monitoring</CardTitle></CardHeader>
            <CardContent className="space-y-2 pb-4">
              <Link to="/operational/live-monitor" className="flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10">
                  <Activity className="h-4 w-4 text-emerald" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Active Classes</p>
                  <p className="text-xs text-muted-foreground">{kpi?.todays_sessions ?? 0} in session now</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <Link to="/operational/live-monitor" className="flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in oklab, hsl(var(--stat-blue)) 15%, transparent)" }}>
                  <MapPin className="h-4 w-4" style={{ color: "hsl(var(--stat-blue))" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Live Area</p>
                  <p className="text-xs text-muted-foreground">Geofenced session map</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Alerts &amp; Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2 pb-4">
              <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose/10">
                  <AlertTriangle className="h-4 w-4 text-rose" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Attendance Disputes</p>
                  <p className="text-xs text-muted-foreground">{kpi?.pending_leaves ?? 0} awaiting review</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber/10">
                  <Plane className="h-4 w-4 text-amber" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Trainer Leave</p>
                  <p className="text-xs text-muted-foreground">{leaveRows?.length ?? 0} pending approval</p>
                </div>
                {!!leaveRows?.length && (
                  <ApprovalActions
                    size="sm"
                    entityName={leaveRows[0]?.trainer_registry?.full_name ?? "Leave request"}
                    rejectTitle="Reject leave request"
                    rejectDescription="The trainer will be notified that this leave request was declined."
                    isPending={decideMut.isPending}
                    onApprove={() => decideMut.mutate({ id: leaveRows[0].id, decision: "APPROVED" })}
                    onReject={(reason) => decideMut.mutate({ id: leaveRows[0].id, decision: "REJECTED", reason })}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose/10">
                  <ArrowLeftRight className="h-4 w-4 text-rose" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Emergency Swap</p>
                  <p className="text-xs text-muted-foreground">Trainer swap workflow</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stat-blue/10">
                  <CalendarDays className="h-4 w-4" style={{ color: "hsl(var(--stat-blue))" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Upcoming Sessions</p>
                  <p className="text-xs text-muted-foreground">{(feedRows?.length ?? 0)} in queue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}