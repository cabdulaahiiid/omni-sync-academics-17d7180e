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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Globe2, Clock, CheckSquare, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/strategic/")({
  component: StrategicDashboard,
});

function StrategicDashboard() {
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const canQuery = Boolean(me?.roles.includes("MA"));
  const stats = useServerFn(getStrategicStats);
  const audit = useServerFn(listRecentAuditLogs);
  const queue = useServerFn(listApprovalQueue);
  const dept = useServerFn(getDepartmentComparison);
  const overrides = useServerFn(listRecentOverrides);
  const approve = useServerFn(approveSchedule);
  const sendBack = useServerFn(sendBackSchedule);

  const { data: kpi } = useQuery({ queryKey: ["strategic-stats"], queryFn: () => stats(), enabled: canQuery, throwOnError: false, staleTime: 30000 });
  const { data: feed } = useQuery({ queryKey: ["audit-feed"], queryFn: () => audit(), enabled: canQuery, throwOnError: false, staleTime: 30000 });
  const { data: pending } = useQuery({ queryKey: ["approval-queue"], queryFn: () => queue(), enabled: canQuery, throwOnError: false, staleTime: 15000 });
  const { data: comparison } = useQuery({ queryKey: ["dept-comparison"], queryFn: () => dept(), enabled: canQuery, throwOnError: false, staleTime: 60000 });
  const { data: overrideRows } = useQuery({ queryKey: ["overrides"], queryFn: () => overrides(), enabled: canQuery, throwOnError: false, staleTime: 60000 });

  if (meLoading) {
    return <div className="flex min-h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  useEffect(() => {
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
  }, [qc]);

  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const approveMut = useMutation({
    mutationFn: (id: string) => approve({ data: { schedule_id: id } }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["approval-queue"] }); qc.invalidateQueries({ queryKey: ["strategic-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendBackMut = useMutation({
    mutationFn: () => sendBack({ data: { schedule_id: feedbackTarget!, feedback: feedbackText } }),
    onSuccess: () => { toast.success("Sent back for correction"); setFeedbackTarget(null); setFeedbackText(""); qc.invalidateQueries({ queryKey: ["approval-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "Active Sessions", value: kpi?.active_sessions ?? 0, icon: Activity, color: "stat-blue" },
    { label: "Geo Compliance", value: `${kpi?.geo_compliance ?? 0}%`, icon: Globe2, color: "stat-green" },
    { label: "Trainer Punctuality", value: `${kpi?.trainer_punctuality ?? 0}%`, icon: Clock, color: "stat-purple" },
    { label: "Attendance (7d)", value: `${kpi?.attendance_pct ?? 0}%`, icon: CheckSquare, color: "stat-orange" },
    { label: "Pending Approvals", value: kpi?.pending_approvals ?? 0, icon: AlertCircle, color: "stat-blue" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Strategic Command Center</h1>
        <p className="text-sm text-muted-foreground">Institution-wide oversight in real time.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden border-l-4" style={{ borderLeftColor: `hsl(var(--${c.color}))` }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4" style={{ color: `hsl(var(--${c.color}))` }} />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Approval Queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!pending?.length && <p className="text-sm text-muted-foreground">No pending schedules.</p>}
            {pending?.map((s) => (
              <div key={s.id} className="flex items-start justify-between rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.module_code} · {s.module_name}</p>
                  <p className="text-xs text-muted-foreground">{s.date} · {s.start_time}–{s.end_time} · {s.trainer_name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.flags?.conflict_trainer && <Badge variant="destructive" className="text-[10px]">Trainer clash</Badge>}
                    {s.flags?.conflict_venue && <Badge variant="destructive" className="text-[10px]">Venue clash</Badge>}
                    {s.flags?.invalid_qualification && <Badge variant="destructive" className="text-[10px]">Qual mismatch</Badge>}
                    {s.flags?.excessive_load && <Badge variant="destructive" className="text-[10px]">Overload</Badge>}
                    {s.status === "FEEDBACK_REQUIRED" && <Badge variant="secondary" className="text-[10px]">Returned</Badge>}
                  </div>
                </div>
                <div className="ml-2 flex shrink-0 gap-1">
                  <Button size="sm" onClick={() => approveMut.mutate(s.id)} disabled={approveMut.isPending}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setFeedbackTarget(s.id)}>Send back</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Department Attendance (7d)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {comparison?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="hsl(var(--stat-blue))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground">No attendance data yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Live Activity Feed</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-1 overflow-y-auto">
            {!feed?.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {feed?.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b py-1.5 text-xs last:border-0">
                <span><Badge variant="outline" className="mr-2">{a.action_type}</Badge>{a.entity_type}</span>
                <span className="text-muted-foreground">{new Date(a.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Override Logs</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {!overrideRows?.length && <p className="text-sm text-muted-foreground">No overrides recorded.</p>}
            {overrideRows?.map((o) => (
              <div key={o.id} className="rounded-md border p-2 text-xs">
                <p className="font-medium">{o.old_value ? "Present→Absent" : "Absent→Present"}</p>
                <p className="text-muted-foreground">{o.audit_comment}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(o.override_timestamp).toLocaleString()}</p>
              </div>
            ))}
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