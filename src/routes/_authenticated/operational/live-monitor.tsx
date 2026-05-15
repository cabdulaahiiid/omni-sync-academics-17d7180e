import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDhLiveChannel } from "@/hooks/use-dh-live-channel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/operational/live-monitor")({
  component: LiveMonitorPage,
});

function LiveMonitorPage() {
  const [deptId, setDeptId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const tick = useDhLiveChannel(deptId);

  useEffect(() => {
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("department_id").maybeSingle();
      setDeptId(prof?.department_id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!deptId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("schedules")
        .select("id, module_code, module_name, trainer_name, start_time, end_time, status, checkin_at, ended_at, date")
        .eq("department_id", deptId)
        .eq("date", today)
        .order("start_time");
      setRows(data ?? []);
    })();
  }, [deptId, tick]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Live Monitoring</h1>
      <p className="text-sm text-muted-foreground">Today's sessions, updating in real time.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((s) => {
          const indicator =
            s.status === "ENDED" ? { label: "Ended", variant: "secondary" as const } :
            s.checkin_at ? { label: "Checked-in", variant: "default" as const } :
            s.status === "LIVE" ? { label: "Live", variant: "outline" as const } :
            { label: s.status, variant: "outline" as const };
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{s.module_code} • {s.module_name}</CardTitle>
                <Badge variant={indicator.variant}>{indicator.label}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>Trainer: {s.trainer_name}</div>
                <div>{s.start_time} – {s.end_time}</div>
                {s.checkin_at && <div>Check-in: {new Date(s.checkin_at).toLocaleTimeString()}</div>}
                {s.ended_at && <div>Ended: {new Date(s.ended_at).toLocaleTimeString()}</div>}
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-muted-foreground">No sessions today.</p>}
      </div>
    </div>
  );
}
