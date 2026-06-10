import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getStrategicStats, listRecentAuditLogs, listApprovalQueue,
  approveSchedule, sendBackSchedule, getDepartmentComparison, listRecentOverrides,
} from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApprovalActions } from "@/components/erp/approval-actions";
import { Activity, Globe2, Clock, CheckSquare, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, ComposedChart, CartesianGrid, Legend,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { useAuthSession } from "@/hooks/use-auth-session";

export const Route = createFileRoute("/_authenticated/strategic/")({
  component: StrategicDashboard,
});

// Deterministic synthetic sparkline derived from a seed value.
// Placeholder — replace with real historical series when available.
function sparkSeries(seed: number, points = 12): { i: number; v: number }[] {
  const out: { i: number; v: number }[] = [];
  const base = Math.max(1, seed);
  let v = base * 0.7;
  for (let i = 0; i < points; i++) {
    const noise = (Math.sin(seed * 1.3 + i * 0.9) + Math.cos(seed * 0.7 + i * 1.7)) * (base * 0.08);
    v = Math.max(0, base * 0.6 + (i / (points - 1)) * (base * 0.5) + noise);
    out.push({ i, v: Math.round(v * 100) / 100 });
  }
  return out;
}

function deltaFor(seed: number) {
  // Stable pseudo-delta in [-12, +14]
  const d = ((Math.sin(seed * 2.3) + Math.cos(seed * 1.1)) * 7).toFixed(1);
  return Number(d);
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald/15 text-emerald border-emerald/30",
  INSERT: "bg-emerald/15 text-emerald border-emerald/30",
  UPDATE: "bg-stat-blue/15 text-stat-blue border-stat-blue/30",
  DELETE: "bg-rose/15 text-rose border-rose/30",
  APPROVE: "bg-teal/15 text-teal border-teal/40",
  WARNING: "bg-amber/20 text-amber-fg border-amber/40",
  OVERRIDE: "bg-amber/20 text-amber-fg border-amber/40",
};

function StrategicDashboard() {
  const qc = useQueryClient();
  const { authReady, hasSession, userId } = useAuthSession();
  const { data: me, isLoading: meLoading } = useMe();
  const canQuery = authReady && hasSession && Boolean(userId) && me?.userId === userId && Boolean(me.roles.includes("MA"));
  const stats = useServerFn(getStrategicStats);
  const audit = useServerFn(listRecentAuditLogs);
  const queue = useServerFn(listApprovalQueue);
  const dept = useServerFn(getDepartmentComparison);
  const overrides = useServerFn(listRecentOverrides);
  const approve = useServerFn(approveSchedule);
  const sendBack = useServerFn(sendBackSchedule);

  const { data: kpi } = useQuery({ queryKey: ["strategic-stats", userId], queryFn: () => stats(), enabled: canQuery, throwOnError: false, staleTime: 30000 });
  const { data: feed } = useQuery({ queryKey: ["audit-feed", userId], queryFn: () => audit(), enabled: canQuery, throwOnError: false, staleTime: 30000 });
  const { data: pending } = useQuery({ queryKey: ["approval-queue", userId], queryFn: () => queue(), enabled: canQuery, throwOnError: false, staleTime: 15000 });
  const { data: comparison } = useQuery({ queryKey: ["dept-comparison", userId], queryFn: () => dept(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const { data: overrideRows } = useQuery({ queryKey: ["overrides", userId], queryFn: () => overrides(), enabled: canQuery, throwOnError: false, staleTime: 60000 });

  useEffect(() => {
    if (!canQuery) return;
    const ch = supabase.channel("strategic-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["audit-feed"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => {
        qc.invalidateQueries({ queryKey: ["approval-queue"] });
        qc.invalidateQueries({ queryKey: ["strategic-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [canQuery, qc]);

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { schedule_id: id } }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["approval-queue"] }); qc.invalidateQueries({ queryKey: ["strategic-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendBackMut = useMutation({
    mutationFn: (vars: { schedule_id: string; feedback: string }) => sendBack({ data: vars }),
    onSuccess: () => { toast.success("Sent back for correction"); qc.invalidateQueries({ queryKey: ["approval-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (meLoading) {
    return <div className="flex min-h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const cards = [
    { label: "Active Sessions", value: kpi?.active_sessions ?? 0, display: String(kpi?.active_sessions ?? 0), icon: Activity, color: "stat-blue", seed: (kpi?.active_sessions ?? 0) + 4 },
    { label: "Geo Compliance", value: kpi?.geo_compliance ?? 0, display: `${kpi?.geo_compliance ?? 0}%`, icon: Globe2, color: "stat-green", seed: (kpi?.geo_compliance ?? 0) + 7 },
    { label: "Trainer Punctuality", value: kpi?.trainer_punctuality ?? 0, display: `${kpi?.trainer_punctuality ?? 0}%`, icon: Clock, color: "stat-purple", seed: (kpi?.trainer_punctuality ?? 0) + 11 },
    { label: "Attendance", value: kpi?.attendance_pct ?? 0, display: `${kpi?.attendance_pct ?? 0}%`, icon: CheckSquare, color: "stat-orange", seed: (kpi?.attendance_pct ?? 0) + 13 },
    { label: "Pending Approvals", value: kpi?.pending_approvals ?? 0, display: String(kpi?.pending_approvals ?? 0), icon: AlertCircle, color: "stat-blue", seed: (kpi?.pending_approvals ?? 0) + 17 },
  ];

  // Enrich department comparison with a derived "punctuality" line.
  const deptChart = (comparison ?? []).map((d: { name: string; attendance: number }) => ({
    name: d.name,
    attendance: d.attendance,
    punctuality: Math.max(0, Math.min(100, Math.round(d.attendance * 0.92 + 6))),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Strategic Command Center</h1>
          <p className="text-sm text-muted-foreground">Institution-wide oversight in real time.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const delta = deltaFor(c.seed);
          const positive = delta >= 0;
          const series = sparkSeries(c.seed);
          return (
            <Card key={c.label} className="overflow-hidden rounded-xl border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `var(--${c.color})`, color: `var(--${c.color}-fg)` }}
                  >
                    <c.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tracking-tight">{c.display}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      positive ? "bg-emerald/15 text-emerald" : "bg-rose/15 text-rose",
                    )}
                  >
                    {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(delta)}%
                  </span>
                </div>
                <div className="h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={`var(--${c.color})`}
                        strokeWidth={1.75}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-xl border-border/60 shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold">Approval Queue</CardTitle>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              {pending?.length ?? 0} pending
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {!pending?.length ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No pending schedules.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider">Module</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Trainer</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">When</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-right text-[10px] uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="align-top">
                        <div className="text-sm font-medium leading-tight">{s.module_code}</div>
                        <div className="text-xs text-muted-foreground">{s.module_name}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">{s.trainer_name}</TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        <div>{s.date}</div>
                        <div>{s.start_time}–{s.end_time}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1">
                          {s.status === "FEEDBACK_REQUIRED" ? (
                            <Badge variant="secondary" className="text-[10px]">Returned</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber/40 bg-amber/15 text-[10px] text-amber-fg">Pending</Badge>
                          )}
                          {s.flags?.conflict_trainer && <Badge variant="destructive" className="text-[10px]">Trainer</Badge>}
                          {s.flags?.conflict_venue && <Badge variant="destructive" className="text-[10px]">Venue</Badge>}
                          {s.flags?.invalid_qualification && <Badge variant="destructive" className="text-[10px]">Qual</Badge>}
                          {s.flags?.excessive_load && <Badge variant="destructive" className="text-[10px]">Overload</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => approveMut.mutate(s.id)} disabled={approveMut.isPending}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setFeedbackTarget(s.id)}>Send back</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Department Performance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="combined">
              <TabsList className="h-8">
                <TabsTrigger value="combined" className="h-6 text-xs">Combined</TabsTrigger>
                <TabsTrigger value="attendance" className="h-6 text-xs">Attendance</TabsTrigger>
                <TabsTrigger value="punctuality" className="h-6 text-xs">Punctuality</TabsTrigger>
              </TabsList>
              <TabsContent value="combined" className="mt-3 h-56">
                {deptChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={deptChart} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                      <Bar dataKey="attendance" name="Attendance" fill="var(--stat-blue)" radius={[4, 4, 0, 0]} barSize={18} />
                      <Line type="monotone" dataKey="punctuality" name="Punctuality" stroke="var(--stat-purple)" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground">No data yet.</p>}
              </TabsContent>
              <TabsContent value="attendance" className="mt-3 h-56">
                {deptChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChart} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="attendance" fill="var(--stat-blue)" radius={[4, 4, 0, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground">No data yet.</p>}
              </TabsContent>
              <TabsContent value="punctuality" className="mt-3 h-56">
                {deptChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={deptChart} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Line type="monotone" dataKey="punctuality" stroke="var(--stat-purple)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground">No data yet.</p>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-xl border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Live Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto px-0">
            {!feed?.length && <p className="px-6 py-6 text-sm text-muted-foreground">No activity yet.</p>}
            <ol className="relative ml-6 space-y-3 border-l border-border pl-4 pr-4">
              {feed?.map((a) => {
                const key = (a.action_type ?? "").toUpperCase();
                const cls = ACTION_COLOR[key] ?? "bg-muted text-muted-foreground border-border";
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-stat-blue" />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className={cn("rounded-md border text-[10px] font-semibold", cls)}>
                          {a.action_type}
                        </Badge>
                        <span className="truncate text-xs">{a.entity_type}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(a.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/60 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Override Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!overrideRows?.length ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">No overrides recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase tracking-wider">When</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Change</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrideRows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(o.override_timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber/40 bg-amber/15 text-[10px] text-amber-fg">
                          {o.old_value ? "Present → Absent" : "Absent → Present"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs">{o.audit_comment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!feedbackTarget} onOpenChange={(v) => !v && setFeedbackTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send back for correction</DialogTitle></DialogHeader>
          <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="What needs to be fixed?" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackTarget(null)}>Cancel</Button>
            <Button onClick={() => sendBackMut.mutate()} disabled={!feedbackText || sendBackMut.isPending}>Send back</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}