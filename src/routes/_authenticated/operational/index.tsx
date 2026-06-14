import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import {
  getDHStatsExt,
  listDHScheduleCommand,
  listDHActiveClasses,
  listDHAttendanceMonitor,
  getDHAnalytics,
  listDHAlerts,
} from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity, CalendarDays, PlayCircle, ClipboardCheck, AlertTriangle,
  ShieldCheck, BarChart3, Timer, Upload, RefreshCw, Eye, Send, XCircle,
  Inbox,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { KpiTile } from "@/components/erp/kpi-tile";
import { DashboardSection } from "@/components/erp/dashboard-section";
import { AlertRow } from "@/components/erp/alert-row";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/operational/")({
  component: DHDashboard,
});

function statusPill(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "LIVE" || s === "ACTIVE") return "bg-emerald/15 text-emerald";
  if (s === "ENDED") return "bg-muted text-muted-foreground";
  if (s === "PENDING_MA") return "bg-amber/15 text-amber-fg";
  if (s === "DRAFT") return "bg-stat-blue/10 text-stat-blue";
  return "bg-muted text-muted-foreground";
}

function DHDashboard() {
  const qc = useQueryClient();
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me } = useMe();
  const canQuery = authReady && hasSession && !!userId && me?.userId === userId
    && (me.roles.includes("DH") || me.roles.includes("MA"));

  const statsFn = useServerFn(getDHStatsExt);
  const schedFn = useServerFn(listDHScheduleCommand);
  const activeFn = useServerFn(listDHActiveClasses);
  const attFn = useServerFn(listDHAttendanceMonitor);
  const analyticsFn = useServerFn(getDHAnalytics);
  const alertsFn = useServerFn(listDHAlerts);

  const kpiQ = useQuery({ queryKey: ["dh-stats", userId], queryFn: () => statsFn(), enabled: canQuery, staleTime: 30000, throwOnError: false });
  const schedQ = useQuery({ queryKey: ["dh-sched", userId], queryFn: () => schedFn(), enabled: canQuery, staleTime: 30000, throwOnError: false });
  const activeQ = useQuery({ queryKey: ["dh-active", userId], queryFn: () => activeFn(), enabled: canQuery, staleTime: 15000, throwOnError: false });
  const attQ = useQuery({ queryKey: ["dh-att-mon", userId], queryFn: () => attFn(), enabled: canQuery, staleTime: 15000, throwOnError: false });
  const analyticsQ = useQuery({ queryKey: ["dh-analytics", userId], queryFn: () => analyticsFn(), enabled: canQuery, staleTime: 60000, throwOnError: false });
  const alertsQ = useQuery({ queryKey: ["dh-alerts", userId], queryFn: () => alertsFn(), enabled: canQuery, staleTime: 20000, throwOnError: false });

  useEffect(() => {
    if (!canQuery) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["dh-stats"] });
      qc.invalidateQueries({ queryKey: ["dh-sched"] });
      qc.invalidateQueries({ queryKey: ["dh-active"] });
      qc.invalidateQueries({ queryKey: ["dh-att-mon"] });
      qc.invalidateQueries({ queryKey: ["dh-alerts"] });
    };
    const ch = supabase.channel("dh-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canQuery, qc]);

  const kpi = kpiQ.data;
  const lastUpdated = kpiQ.dataUpdatedAt || null;
  const scheds = schedQ.data ?? [];
  const active = activeQ.data ?? [];
  const att = attQ.data;
  const analytics = analyticsQ.data ?? [];
  const alerts = alertsQ.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scheds.find((s) => s.id === selectedId) ?? scheds[0] ?? null;

  const kpiTiles = [
    { label: "Active Classes Today",     value: kpi?.active_today ?? 0,            icon: PlayCircle,    tone: "blue" as const,   delta: null,                                  to: "/operational/live-monitor", emptyHint: "No classes running" },
    { label: "Dept Attendance Rate",     value: `${kpi?.attendance_pct ?? 0}%`,    icon: ClipboardCheck, tone: "green" as const,  delta: null,                                  to: "/operational/attendance",   emptyHint: "No attendance today" },
    { label: "Pending Schedule Reviews", value: kpi?.pending_reviews ?? 0,         icon: Inbox,         tone: "amber" as const,  delta: null,                                  to: "/operational/drafts",       emptyHint: "Queue is clear" },
    { label: "Submitted Attendance",     value: kpi?.submitted_attendance ?? 0,    icon: Upload,        tone: "purple" as const, delta: null,                                  to: "/operational/attendance",   emptyHint: "No submissions yet" },
    { label: "Missing Attendance",       value: kpi?.missing_attendance ?? 0,      icon: AlertTriangle, tone: "rose" as const,   delta: null,                                  to: "/operational/attendance",   emptyHint: "All sessions logged" },
    { label: "Weekly Compliance",        value: `${kpi?.weekly_compliance ?? 0}%`, icon: ShieldCheck,   tone: "orange" as const, delta: null,                                  to: "/operational/reports",      emptyHint: "No schedule activity" },
  ];

  return (
    <div className="space-y-6">
      <div className="card-elevated rounded-2xl border border-border/70 bg-gradient-to-br from-[var(--nav-bg)] to-[var(--nav-bg-2)] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Department Operations Center</p>
            <h1 className="mt-1 truncate text-[24px] font-semibold tracking-tight">
              {greetOpDH(me?.profile?.full_name)}
            </h1>
            <p className="mt-1 text-[12px] text-white/65">
              Live status for your department · Updated{" "}
              <span className="font-medium text-white">
                {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 bg-white/10 text-white hover:bg-white/20 border border-white/15"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["dh-stats"] });
              qc.invalidateQueries({ queryKey: ["dh-sched"] });
              qc.invalidateQueries({ queryKey: ["dh-active"] });
              qc.invalidateQueries({ queryKey: ["dh-att-mon"] });
              qc.invalidateQueries({ queryKey: ["dh-analytics"] });
              qc.invalidateQueries({ queryKey: ["dh-alerts"] });
            }}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DHHeaderChip label="Active Today" value={String(kpi?.active_today ?? 0)} />
          <DHHeaderChip label="Attendance" value={`${kpi?.attendance_pct ?? 0}%`} />
          <DHHeaderChip label="Pending Reviews" value={String(kpi?.pending_reviews ?? 0)} />
          <DHHeaderChip label="Compliance" value={`${kpi?.weekly_compliance ?? 0}%`} />
        </div>
      </div>

      <DashboardSection title="Department KPIs" description="Click any tile to drill into source records.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiTiles.map((t) => (
            <KpiTile key={t.label} {...t} lastUpdated={lastUpdated} />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Schedule Command Center"
        description="Select a row to load detail and actions on the right."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/operational/drafts">Open drafts →</Link>
          </Button>
        }
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)] lg:col-span-2">
            <CardContent className="p-0">
              {scheds.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming sessions"
                  description="Nothing scheduled for your department in the next 7 days."
                  className="m-4"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[var(--surface-sunken)]">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase tracking-wider">Week</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Trainer</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Course</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Schedule</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider">Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheds.map((s) => {
                        const isSel = selected?.id === s.id;
                        return (
                          <TableRow
                            key={s.id}
                            onClick={() => setSelectedId(s.id)}
                            className={cn(
                              "h-11 cursor-pointer",
                              isSel ? "bg-stat-blue/10 hover:bg-stat-blue/10" : "hover:bg-muted/40",
                            )}
                          >
                            <TableCell className="text-xs font-medium">{s.week_num ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.date}</TableCell>
                            <TableCell className="text-xs">{s.trainer_name ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{s.module_code}</div>
                              <div className="text-muted-foreground">{s.module_name}</div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("rounded-full text-[10px]", statusPill(s.status))}>{s.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.attendance_count} logs</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              {!selected ? (
                <p className="text-xs text-muted-foreground">Select a row to see actions.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border/70 bg-card p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Selected</p>
                    <p className="mt-0.5 text-sm font-semibold">{selected.module_code}</p>
                    <p className="text-xs text-muted-foreground">{selected.module_name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {selected.date} • {selected.start_time}–{selected.end_time} • {selected.trainer_name ?? "Unassigned"}
                    </p>
                    <Badge className={cn("mt-2 rounded-full text-[10px]", statusPill(selected.status))}>{selected.status}</Badge>
                  </div>
                  <Button asChild size="sm" variant="default" className="w-full">
                    <Link to="/operational/drafts"><Eye className="mr-2 h-3.5 w-3.5" /> Review schedule</Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary" className="w-full">
                    <Link to="/operational/drafts"><ClipboardCheck className="mr-2 h-3.5 w-3.5" /> Approve submission</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/operational/drafts"><Send className="mr-2 h-3.5 w-3.5" /> Return for correction</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="w-full">
                    <Link to="/operational/matrix"><CalendarDays className="mr-2 h-3.5 w-3.5" /> View timetable</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      <DashboardSection title="Live Monitoring" description="Right-now activity and today's attendance roll-up.">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Active Classes</CardTitle>
              <Badge variant="outline" className="rounded-full text-[10px]">{active.length} now</Badge>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {active.length === 0 ? (
                <EmptyState icon={Activity} title="No classes running" description="No live or active session in your department right now." />
              ) : (
                active.map((c) => (
                  <Link
                    key={c.id}
                    to="/operational/live-monitor"
                    className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                      <PlayCircle className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.module_code} • {c.module_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.trainer_name ?? "—"} · {c.start_time}–{c.end_time}
                      </p>
                    </div>
                    <Badge className={cn("rounded-full text-[10px]", statusPill(c.status))}>{c.status}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Attendance Monitoring</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Link to="/operational/attendance" className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="flex-1"><p className="font-medium">Submitted</p><p className="text-xs text-muted-foreground">Sessions ended with attendance log</p></div>
                <span className="text-base font-semibold tabular-nums">{att?.submitted ?? 0}</span>
              </Link>
              <Link to="/operational/attendance" className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose/15 text-rose">
                  <XCircle className="h-4 w-4" />
                </div>
                <div className="flex-1"><p className="font-medium">Missing</p><p className="text-xs text-muted-foreground">Ended sessions, no log filed</p></div>
                <span className="text-base font-semibold tabular-nums">{att?.missing ?? 0}</span>
              </Link>
              <Link to="/operational/live-monitor" className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-sm transition-colors hover:bg-muted/40">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber/20 text-amber-fg">
                  <Timer className="h-4 w-4" />
                </div>
                <div className="flex-1"><p className="font-medium">Late</p><p className="text-xs text-muted-foreground">Check-in &gt; 15min after start</p></div>
                <span className="text-base font-semibold tabular-nums">{att?.late ?? 0}</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      <DashboardSection title="Department Analytics" description="8-week trend for the metrics that matter.">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardContent className="h-72 p-4">
            {analytics.length === 0 ? (
              <EmptyState icon={BarChart3} title="No trend data yet" description="Trend lines populate as sessions complete." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  <Line type="monotone" dataKey="attendance"  name="Attendance"  stroke="var(--stat-blue)"   strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="punctuality" name="Punctuality" stroke="var(--stat-purple)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="completion"  name="Completion"  stroke="var(--stat-green)"  strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </DashboardSection>

      <DashboardSection title="Department Alerts">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardContent className="space-y-2 p-4">
            {alerts.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="All clear" description="No outstanding issues for your department." />
            ) : (
              alerts.map((a) => (
                <AlertRow key={a.id} severity={a.severity as any} title={a.title} detail={a.detail} count={a.count} to={a.to} />
              ))
            )}
          </CardContent>
        </Card>
      </DashboardSection>
    </div>
  );
}
