import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDepartmentComparison, getStrategicStats } from "@/lib/data.functions";
import { listSemesters } from "@/lib/ma.functions";
import {
  getStrategicStatsExt,
  getApprovalQueueSummary,
  getInstitutionActivity,
  listCriticalAlerts,
  getDepartmentPerformance,
  getWeeklyApprovalSeries,
  listLiveActivityFeed,
} from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, Globe2, Clock, CheckSquare, AlertCircle, Building2,
  Inbox, ClipboardCheck, Send, XCircle,
  PlayCircle, CheckCircle2, AlertTriangle, Timer, Upload,
  ShieldCheck, BarChart3, ScrollText, Users, Settings, RefreshCw,
  GraduationCap, BookOpen, MapPin, Grid3x3, CalendarRange,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { useAuthSession } from "@/hooks/use-auth-session";
import { KpiTile } from "@/components/erp/kpi-tile";
import { DashboardSection } from "@/components/erp/dashboard-section";
import { AlertRow } from "@/components/erp/alert-row";
import { ActivityRow } from "@/components/erp/activity-row";
import { EmptyState } from "@/components/erp/empty-state";
import { HealthScoreCard } from "@/components/erp/health-score-card";
import { AIInsightsPanel, type Insight } from "@/components/erp/ai-insights-panel";
import { ReportingStrip } from "@/components/erp/reporting-strip";
import { computeHealthScore, readPrevHealth, writeHealth } from "@/lib/ui/health-score";

export const Route = createFileRoute("/_authenticated/strategic/")({
  component: StrategicDashboard,
});

const ACTION_HINTS: { to: string; label: string; icon: typeof CheckSquare }[] = [
  { to: "/strategic/approvals",   label: "Approvals",     icon: CheckSquare },
  { to: "/strategic/audit",       label: "Audit Logs",    icon: ScrollText },
  { to: "/strategic/insights",    label: "Insights",      icon: BarChart3 },
  { to: "/strategic/users",       label: "Users & Roles", icon: Users },
  { to: "/strategic/departments", label: "Departments",   icon: Building2 },
  { to: "/strategic/settings",    label: "Settings",      icon: Settings },
];

function StrategicDashboard() {
  const qc = useQueryClient();
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me, isLoading: meLoading } = useMe();
  const canQuery = authReady && hasSession && Boolean(userId) && me?.userId === userId && Boolean(me.roles.includes("MA"));

  const stats = useServerFn(getStrategicStatsExt);
  const queueSum = useServerFn(getApprovalQueueSummary);
  const activity = useServerFn(getInstitutionActivity);
  const alertsFn = useServerFn(listCriticalAlerts);
  const deptPerf = useServerFn(getDepartmentPerformance);
  const weeklyFn = useServerFn(getWeeklyApprovalSeries);
  const feedFn = useServerFn(listLiveActivityFeed);
  const dept = useServerFn(getDepartmentComparison);
  const totalsFn = useServerFn(getStrategicStats);
  const semFn = useServerFn(listSemesters);

  const kpiQ = useQuery({ queryKey: ["mc-stats", userId], queryFn: () => stats(), enabled: canQuery, throwOnError: false, staleTime: 30000 });
  const queueQ = useQuery({ queryKey: ["mc-queue", userId], queryFn: () => queueSum(), enabled: canQuery, throwOnError: false, staleTime: 15000 });
  const actQ = useQuery({ queryKey: ["mc-activity", userId], queryFn: () => activity(), enabled: canQuery, throwOnError: false, staleTime: 15000 });
  const alertsQ = useQuery({ queryKey: ["mc-alerts", userId], queryFn: () => alertsFn(), enabled: canQuery, throwOnError: false, staleTime: 20000 });
  const deptQ = useQuery({ queryKey: ["mc-dept-perf", userId], queryFn: () => deptPerf(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const weeklyQ = useQuery({ queryKey: ["mc-weekly", userId], queryFn: () => weeklyFn(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const feedQ = useQuery({ queryKey: ["mc-feed", userId], queryFn: () => feedFn(), enabled: canQuery, throwOnError: false, staleTime: 15000 });
  // Comparison query reserved for future drill-down enrichment
  useQuery({ queryKey: ["mc-compare", userId], queryFn: () => dept(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const totalsQ = useQuery({ queryKey: ["mc-totals", userId], queryFn: () => totalsFn(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const semQ = useQuery({ queryKey: ["mc-sem", userId], queryFn: () => semFn(), enabled: canQuery, throwOnError: false, staleTime: 120000 });

  useEffect(() => {
    if (!canQuery) return;
    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ["mc-feed"] });
      qc.invalidateQueries({ queryKey: ["mc-stats"] });
      qc.invalidateQueries({ queryKey: ["mc-queue"] });
      qc.invalidateQueries({ queryKey: ["mc-activity"] });
      qc.invalidateQueries({ queryKey: ["mc-alerts"] });
    };
    const ch = supabase.channel("strategic-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, invalidateAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, invalidateAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canQuery, qc]);

  if (meLoading) {
    return <div className="flex min-h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const kpi = kpiQ.data;
  const lastUpdated = kpiQ.dataUpdatedAt || null;
  const queue = queueQ.data;
  const act = actQ.data;
  const alerts = alertsQ.data ?? [];
  const deptPerfData = deptQ.data ?? [];
  const weekly = weeklyQ.data ?? [];
  const feed = feedQ.data ?? [];
  const totals = totalsQ.data;
  const semesters = semQ.data ?? [];
  const activeSemester = semesters.find((s: any) => s.status === "ACTIVE" || s.status === "DISTRIBUTED") ?? semesters[0];

  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = me?.profile?.full_name?.split(" ")[0] || "Administrator";

  // Health score
  const health = useMemo(() => kpi ? computeHealthScore({
    attendance_pct: kpi.attendance_pct ?? 0,
    trainer_punctuality: kpi.trainer_punctuality ?? 0,
    geo_compliance: kpi.geo_compliance ?? 0,
    departments_reporting: kpi.departments_reporting ?? 0,
    departments_total: kpi.departments_total ?? 0,
    pending_approvals: kpi.pending_approvals ?? 0,
  }) : null, [kpi]);

  const prevScore = readPrevHealth();
  useEffect(() => { if (health) writeHealth(health.score); }, [health?.score]);
  const weeklyDelta = health && prevScore != null ? health.score - prevScore : null;

  // AI insights — pure derivations from real data
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    if (!kpi) return out;
    const weakest = [...deptPerfData].sort((a, b) => a.attendance - b.attendance)[0];
    if (weakest && weakest.attendance < 70) {
      out.push({
        id: "weak-dept",
        severity: weakest.attendance < 50 ? "crit" : "warn",
        icon: "alert",
        title: `${weakest.name} needs attention`,
        detail: `Attendance ${weakest.attendance}% over last 7 days · completion ${weakest.completion}%.`,
        to: `/strategic/departments`,
      });
    }
    if ((kpi.attendance_delta ?? 0) <= -10) {
      out.push({
        id: "att-drop",
        severity: "warn",
        icon: "trend",
        title: "Attendance anomaly detected",
        detail: `Weekly attendance dropped ${Math.abs(kpi.attendance_delta!)}% vs prior period.`,
        to: "/strategic/insights",
      });
    }
    const topDept = [...deptPerfData].sort((a, b) => b.punctuality - a.punctuality)[0];
    if (topDept && topDept.punctuality >= 85) {
      out.push({
        id: "trainer-top",
        severity: "info",
        icon: "trend",
        title: `${topDept.name} leads on punctuality`,
        detail: `${topDept.punctuality}% on-time check-ins — top performing department this week.`,
        to: "/strategic/insights",
      });
    }
    if (totals && (totals.counts?.students ?? 0) > 0) {
      out.push({
        id: "enrollment",
        severity: "info",
        icon: "users",
        title: "Student enrollment overview",
        detail: `${totals.counts.students.toLocaleString()} students across ${totals.counts.departments ?? 0} departments and ${semesters.length} semester record(s).`,
        to: "/strategic/students",
      });
    }
    const reportingRatio = kpi.departments_total
      ? Math.round((kpi.departments_reporting / kpi.departments_total) * 100)
      : 0;
    if (kpi.departments_total > 0 && reportingRatio < 60) {
      out.push({
        id: "resource-util",
        severity: "warn",
        icon: "activity",
        title: "Resource utilization low",
        detail: `Only ${kpi.departments_reporting}/${kpi.departments_total} departments running sessions today.`,
        to: "/strategic/departments",
      });
    }
    return out;
  }, [kpi, deptPerfData, totals, semesters]);

  const reportingStats = useMemo(() => {
    const c = totals?.counts ?? { departments: 0, trainers: 0, students: 0, schedules: 0 };
    return [
      { label: "Departments", value: c.departments,                 icon: Building2,     to: "/strategic/departments" },
      { label: "Trainers",    value: c.trainers,                    icon: Users,         to: "/strategic/trainers" },
      { label: "Students",    value: c.students.toLocaleString?.() ?? c.students, icon: GraduationCap, to: "/strategic/students" },
      { label: "Modules",     value: kpi?.active_sessions ?? 0,     icon: BookOpen,      to: "/strategic/modules" },
      { label: "Venues",      value: c.schedules,                   icon: MapPin,        to: "/strategic/venues" },
      { label: "Sections",    value: 0,                             icon: Grid3x3,       to: "/strategic/sections" },
      { label: "Semesters",   value: semesters.length,              icon: CalendarRange, to: "/strategic/semesters" },
    ];
  }, [totals, kpi, semesters]);

  const kpiTiles = [
    { label: "Active Sessions",        value: kpi?.active_sessions ?? 0,            icon: Activity,    tone: "blue" as const,   delta: null,                                       to: "/strategic/audit",        emptyHint: "No sessions live right now" },
    { label: "Pending Approvals",      value: kpi?.pending_approvals ?? 0,          icon: AlertCircle, tone: "amber" as const,  delta: null,                                       to: "/strategic/approvals",    emptyHint: "Queue is clear" },
    { label: "Attendance Rate",        value: `${kpi?.attendance_pct ?? 0}%`,       icon: CheckSquare, tone: "green" as const,  delta: kpi?.attendance_delta ?? null,              to: "/strategic/insights",     emptyHint: "No attendance logged this week" },
    { label: "Trainer Punctuality",    value: `${kpi?.trainer_punctuality ?? 0}%`,  icon: Clock,       tone: "purple" as const, delta: kpi?.trainer_punctuality_delta ?? null,     to: "/strategic/insights",     emptyHint: "No check-ins recorded" },
    { label: "Geo Compliance",         value: `${kpi?.geo_compliance ?? 0}%`,       icon: Globe2,      tone: "orange" as const, delta: kpi?.geo_compliance_delta ?? null,          to: "/strategic/audit",        emptyHint: "No session logs yet" },
    { label: "Departments Reporting",  value: `${kpi?.departments_reporting ?? 0}/${kpi?.departments_total ?? 0}`, icon: Building2, tone: "blue" as const, delta: null,            to: "/strategic/departments",  emptyHint: "No departments scheduling today" },
  ];

  const deptChart = deptPerfData.map((d) => ({
    name: d.name.length > 14 ? d.name.slice(0, 12) + "…" : d.name,
    attendance: d.attendance,
    punctuality: d.punctuality,
    completion: d.completion,
    id: d.id,
  }));

  return (
    <div className="space-y-6">
      {/* Executive header band */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card-elevated rounded-2xl border border-border/70 bg-gradient-to-br from-[var(--nav-bg)] to-[var(--nav-bg-2)] p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">Strategic Command Center</p>
              <h1 className="mt-1 truncate text-[24px] font-semibold tracking-tight">{greet}, {userName}</h1>
              <p className="mt-1 text-[12px] text-white/65">
                Institution-wide oversight in real time · Updated{" "}
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
                qc.invalidateQueries({ queryKey: ["mc-stats"] });
                qc.invalidateQueries({ queryKey: ["mc-queue"] });
                qc.invalidateQueries({ queryKey: ["mc-activity"] });
                qc.invalidateQueries({ queryKey: ["mc-alerts"] });
                qc.invalidateQueries({ queryKey: ["mc-dept-perf"] });
                qc.invalidateQueries({ queryKey: ["mc-weekly"] });
                qc.invalidateQueries({ queryKey: ["mc-feed"] });
                qc.invalidateQueries({ queryKey: ["mc-totals"] });
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HeaderChip label="Academic Year" value={activeSemester?.name?.match(/\d{4}/)?.[0] ?? new Date().getFullYear().toString()} />
            <HeaderChip label="Active Semester" value={activeSemester?.name ?? "—"} />
            <HeaderChip label="Active Sessions" value={String(kpi?.active_sessions ?? 0)} />
            <HeaderChip label="Last Sync" value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />
          </div>
        </div>
        {health && <HealthScoreCard health={health} weeklyDelta={weeklyDelta} />}
      </div>

      <DashboardSection title="Executive KPIs" description="Click any tile to drill into the source records.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpiTiles.map((t) => (
            <KpiTile key={t.label} {...t} lastUpdated={lastUpdated} />
          ))}
        </div>
      </DashboardSection>

      <AIInsightsPanel insights={insights} />

      <DashboardSection title="Operational Control" description="Approval queue • institution activity • critical alerts">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Approval Queue Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              <QueueRow icon={Inbox}          tone="amber" label="Pending"          value={queue?.pending ?? 0}          to="/strategic/approvals" />
              <QueueRow icon={ClipboardCheck} tone="green" label="Approved Today"   value={queue?.approved_today ?? 0}   to="/strategic/audit" />
              <QueueRow icon={Send}           tone="blue"  label="Returned (7d)"    value={queue?.returned ?? 0}         to="/strategic/approvals" />
              <QueueRow icon={XCircle}        tone="rose"  label="Rejected (all)"   value={queue?.rejected ?? 0}         to="/strategic/audit" />
              <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                <Link to="/strategic/approvals">View full approval queue →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Institution Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              <QueueRow icon={PlayCircle}    tone="blue"   label="Active Classes"      value={act?.active_classes ?? 0}             to="/strategic/audit" />
              <QueueRow icon={CheckCircle2}  tone="green"  label="Completed Today"     value={act?.completed_today ?? 0}            to="/strategic/audit" />
              <QueueRow icon={AlertTriangle} tone="rose"   label="Missing Attendance"  value={act?.missing_attendance ?? 0}         to="/strategic/audit" />
              <QueueRow icon={Timer}         tone="amber"  label="Late Check-ins"      value={act?.late_attendance ?? 0}            to="/strategic/audit" />
              <QueueRow icon={Upload}        tone="purple" label="Submissions Today"   value={act?.schedule_submissions_today ?? 0} to="/strategic/audit" />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Critical Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-0">
              {alerts.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="All clear"
                  description="No critical issues across the institution right now."
                />
              ) : alerts.map((a) => (
                <AlertRow
                  key={a.id}
                  severity={a.severity}
                  title={a.title}
                  detail={a.detail}
                  count={a.count}
                  to={a.to}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      <DashboardSection title="Analytics" description="Hover bars for detail; open buttons drill into the source page.">
        <div className="grid gap-3 lg:grid-cols-5">
          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)] lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Department Performance</CardTitle>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link to="/strategic/departments">Open →</Link>
              </Button>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              {deptChart.length === 0 ? (
                <EmptyState icon={Building2} title="No department activity in the last 7 days" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptChart} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                    <Bar dataKey="attendance"  name="Attendance"  fill="var(--stat-blue)"   radius={[4, 4, 0, 0]} />
                    <Bar dataKey="punctuality" name="Punctuality" fill="var(--stat-purple)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completion"  name="Completion"  fill="var(--stat-green)"  radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)] lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Weekly Approval Analytics</CardTitle>
              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                <Link to="/strategic/approvals">Open →</Link>
              </Button>
            </CardHeader>
            <CardContent className="h-64 pt-0">
              {weekly.length === 0 ? (
                <EmptyState icon={CheckSquare} title="No approval activity in the last 8 weeks" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="week" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                    <Bar dataKey="approved" stackId="a" name="Approved" fill="var(--emerald)" />
                    <Bar dataKey="rejected" stackId="a" name="Rejected" fill="var(--rose)" />
                    <Bar dataKey="pending"  stackId="a" name="Pending"  fill="var(--amber)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      <DashboardSection title="Quick Actions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ACTION_HINTS.map((a) => (
            <Button
              key={a.to}
              asChild
              variant="outline"
              className="h-auto justify-start gap-2 rounded-xl border-border/70 bg-[var(--surface-raised)] px-3 py-2.5 text-[13px]"
            >
              <Link to={a.to as string}>
                <a.icon className="h-4 w-4" />
                {a.label}
              </Link>
            </Button>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title="Live Activity Feed" description="Latest audit events, session submissions, and overrides.">
        <Card className="rounded-xl border-border/70 bg-[var(--surface-raised)]">
          <CardContent className="max-h-96 overflow-y-auto p-4">
            {feed.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" />
            ) : (
              <ol className="space-y-0.5 border-l border-border">
                {feed.map((f) => (
                  <ActivityRow
                    key={f.id}
                    action={f.action}
                    entity={f.entity}
                    detail={f.detail}
                    timestamp={f.timestamp}
                    to={f.to}
                  />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </DashboardSection>

      <DashboardSection title="Institution Totals" description="Counts across the entire installation.">
        <ReportingStrip stats={reportingStats} />
      </DashboardSection>
    </div>
  );
}

function HeaderChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/8 px-3 py-2 ring-1 ring-white/10">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/55">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-white">{value}</p>
    </div>
  );
}

function QueueRow({
  icon: Icon, tone, label, value, to,
}: { icon: typeof CheckSquare; tone: "blue" | "green" | "purple" | "orange" | "rose" | "amber"; label: string; value: number; to: string }) {
  const TONE: Record<string, string> = {
    blue:   "bg-stat-blue/10 text-stat-blue",
    green:  "bg-stat-green/10 text-stat-green",
    purple: "bg-stat-purple/10 text-stat-purple",
    orange: "bg-stat-orange/10 text-stat-orange",
    rose:   "bg-rose/15 text-rose",
    amber:  "bg-amber/20 text-amber-fg",
  };
  return (
    <Link to={to as string} className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 transition-colors hover:bg-muted/40">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
      </div>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
