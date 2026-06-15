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
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar,
} from "recharts";
import { cn } from "@/lib/utils";
import { KpiTile } from "@/components/erp/kpi-tile";
import { AlertRow } from "@/components/erp/alert-row";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLiveTables } from "@/hooks/use-live-tables";

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
  useLiveTables(
    ["schedules", "approval_queue", "attendance_logs", "session_logs", "attendance_overrides", "students", "trainer_registry", "modules"],
    ["dh-stats", "dh-sched", "dh-active", "dh-att-mon", "dh-analytics", "dh-alerts"],
  );
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
    { label: "Active Classes",       value: kpi?.active_today ?? 0,            icon: PlayCircle,    tone: "blue" as const,   to: "/operational/live-monitor", emptyHint: "None running" },
    { label: "Attendance Rate",      value: `${kpi?.attendance_pct ?? 0}%`,    icon: ClipboardCheck, tone: "green" as const,  to: "/operational/attendance",   emptyHint: "No data" },
    { label: "Pending Reviews",      value: kpi?.pending_reviews ?? 0,         icon: Inbox,         tone: "amber" as const,  to: "/operational/drafts",       emptyHint: "Clear" },
    { label: "Submitted Attendance", value: kpi?.submitted_attendance ?? 0,    icon: Upload,        tone: "purple" as const, to: "/operational/attendance",   emptyHint: "None" },
    { label: "Missing Attendance",   value: kpi?.missing_attendance ?? 0,      icon: AlertTriangle, tone: "rose" as const,   to: "/operational/attendance",   emptyHint: "All logged" },
    { label: "Weekly Compliance",    value: `${kpi?.weekly_compliance ?? 0}%`, icon: ShieldCheck,   tone: "orange" as const, to: "/operational/reports",      emptyHint: "No activity" },
  ];

  return (
    <div className="space-y-3">
      {/* Page title bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Department Operations Center</h1>
          <p className="text-[11px] text-muted-foreground">
            Live status • <span className="font-medium text-foreground">Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          </p>
        </div>
        <Button
          size="sm" variant="outline" className="h-8"
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

      {/* ROW 1 — Compact KPI strip (sticky) */}
      <div className="sticky top-0 z-10 -mx-3 bg-background/85 px-3 py-2 backdrop-blur lg:-mx-4 lg:px-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {kpiTiles.map((t) => (
            <KpiTile key={t.label} {...t} lastUpdated={lastUpdated} compact />
          ))}
        </div>
      </div>

      {/* ROW 2 — Schedule 70% + Side rail 30% */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-10">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)] lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 pb-2 pt-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Schedule Command Center</CardTitle>
              <p className="text-[10px] text-muted-foreground">Select a row to load actions on the right.</p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7">
              <Link to="/operational/drafts">Open drafts →</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {scheds.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming sessions" description="Nothing scheduled in the next 7 days." className="m-3" />
            ) : (
              <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[var(--surface-sunken)]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wider">Week</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Trainer</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Course</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider">Att.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scheds.map((s) => {
                      const isSel = selected?.id === s.id;
                      return (
                        <TableRow
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          className={cn("h-9 cursor-pointer", isSel ? "bg-stat-blue/10 hover:bg-stat-blue/10" : "hover:bg-muted/40")}
                        >
                          <TableCell className="py-1 text-xs font-medium">{s.week_num ?? "—"}</TableCell>
                          <TableCell className="py-1 text-xs text-muted-foreground">{s.date}</TableCell>
                          <TableCell className="py-1 text-xs">{s.trainer_name ?? "—"}</TableCell>
                          <TableCell className="py-1 text-xs">
                            <div className="font-medium">{s.module_code}</div>
                            <div className="truncate text-[10px] text-muted-foreground">{s.module_name}</div>
                          </TableCell>
                          <TableCell className="py-1">
                            <Badge className={cn("rounded-full text-[10px]", statusPill(s.status))}>{s.status}</Badge>
                          </TableCell>
                          <TableCell className="py-1 text-xs text-muted-foreground">{s.attendance_count}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:col-span-3">
          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-sm font-semibold">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0">
              {!selected ? (
                <p className="text-xs text-muted-foreground">Select a row to see actions.</p>
              ) : (
                <>
                  <div className="rounded-lg border border-border/70 bg-card p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected</p>
                    <p className="mt-0.5 text-sm font-semibold">{selected.module_code}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{selected.module_name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {selected.date} • {selected.start_time}–{selected.end_time}
                    </p>
                    <Badge className={cn("mt-1.5 rounded-full text-[10px]", statusPill(selected.status))}>{selected.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button asChild size="sm" className="h-8 text-xs"><Link to="/operational/drafts"><Eye className="mr-1 h-3 w-3" />Review</Link></Button>
                    <Button asChild size="sm" variant="secondary" className="h-8 text-xs"><Link to="/operational/drafts"><ClipboardCheck className="mr-1 h-3 w-3" />Approve</Link></Button>
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs"><Link to="/operational/drafts"><Send className="mr-1 h-3 w-3" />Return</Link></Button>
                    <Button asChild size="sm" variant="ghost" className="h-8 text-xs"><Link to="/operational/matrix"><CalendarDays className="mr-1 h-3 w-3" />Matrix</Link></Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-sm font-semibold">Live Alerts</CardTitle></CardHeader>
            <CardContent className="max-h-48 space-y-1.5 overflow-y-auto px-3 pb-3 pt-0">
              {alerts.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="All clear" description="No outstanding issues." />
              ) : (
                alerts.map((a) => (
                  <AlertRow key={a.id} severity={a.severity as any} title={a.title} detail={a.detail} count={a.count} to={a.to} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-sm font-semibold">Approval & Drafts</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 px-3 pb-3 pt-0 text-xs">
              <Link to="/operational/drafts" className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-1.5 hover:bg-muted/40">
                <span className="text-muted-foreground">Pending reviews</span>
                <span className="font-semibold tabular-nums">{kpi?.pending_reviews ?? 0}</span>
              </Link>
              <Link to="/operational/drafts" className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-1.5 hover:bg-muted/40">
                <span className="text-muted-foreground">Submitted attendance</span>
                <span className="font-semibold tabular-nums">{kpi?.submitted_attendance ?? 0}</span>
              </Link>
              <Link to="/operational/attendance" className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-2.5 py-1.5 hover:bg-muted/40">
                <span className="text-muted-foreground">Missing attendance</span>
                <span className="font-semibold tabular-nums text-rose">{kpi?.missing_attendance ?? 0}</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ROW 3 — Active Classes 50% + Attendance Monitoring 50% */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardHeader className="flex flex-row items-center justify-between px-3 pb-2 pt-3">
            <CardTitle className="text-sm font-semibold">Active Classes</CardTitle>
            <Badge variant="outline" className="rounded-full text-[10px]">{active.length} now</Badge>
          </CardHeader>
          <CardContent className="max-h-[320px] space-y-1.5 overflow-y-auto px-3 pb-3 pt-0">
            {active.length === 0 ? (
              <EmptyState icon={Activity} title="No classes running" description="No live or active session right now." />
            ) : (
              active.map((c) => (
                <Link key={c.id} to="/operational/live-monitor" className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald/10 text-emerald">
                    <PlayCircle className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.module_code} • {c.module_name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{c.trainer_name ?? "—"} · {c.start_time}–{c.end_time}</p>
                  </div>
                  <Badge className={cn("rounded-full text-[10px]", statusPill(c.status))}>{c.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardHeader className="px-3 pb-2 pt-3"><CardTitle className="text-sm font-semibold">Attendance Monitoring</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-3 pt-0">
            <Link to="/operational/attendance" className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald/10 text-emerald"><ClipboardCheck className="h-3.5 w-3.5" /></div>
              <div className="flex-1"><p className="text-xs font-medium">Submitted</p><p className="text-[10px] text-muted-foreground">Sessions ended with log</p></div>
              <span className="text-sm font-semibold tabular-nums">{att?.submitted ?? 0}</span>
            </Link>
            <Link to="/operational/attendance" className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose/15 text-rose"><XCircle className="h-3.5 w-3.5" /></div>
              <div className="flex-1"><p className="text-xs font-medium">Missing</p><p className="text-[10px] text-muted-foreground">Ended sessions, no log</p></div>
              <span className="text-sm font-semibold tabular-nums">{att?.missing ?? 0}</span>
            </Link>
            <Link to="/operational/live-monitor" className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-2 text-sm transition-colors hover:bg-muted/40">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber/20 text-amber-fg"><Timer className="h-3.5 w-3.5" /></div>
              <div className="flex-1"><p className="text-xs font-medium">Late</p><p className="text-[10px] text-muted-foreground">&gt;15min after start</p></div>
              <span className="text-sm font-semibold tabular-nums">{att?.late ?? 0}</span>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ROW 4 — Three analytics columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardHeader className="px-3 pb-1 pt-3"><CardTitle className="text-sm font-semibold">Attendance Analytics</CardTitle></CardHeader>
          <CardContent className="h-52 px-2 pb-3 pt-0">
            {analytics.length === 0 ? (
              <EmptyState icon={BarChart3} title="No trend data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="attendance" name="Attendance" stroke="var(--stat-blue)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardHeader className="px-3 pb-1 pt-3"><CardTitle className="text-sm font-semibold">Trainer Compliance</CardTitle></CardHeader>
          <CardContent className="h-52 px-2 pb-3 pt-0">
            {analytics.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="punctuality" name="Punctuality" stroke="var(--stat-purple)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)] md:col-span-2 xl:col-span-1">
          <CardHeader className="px-3 pb-1 pt-3"><CardTitle className="text-sm font-semibold">Schedule Analytics</CardTitle></CardHeader>
          <CardContent className="h-52 px-2 pb-3 pt-0">
            {analytics.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis fontSize={9} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Bar dataKey="completion" name="Completion" fill="var(--stat-green)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}