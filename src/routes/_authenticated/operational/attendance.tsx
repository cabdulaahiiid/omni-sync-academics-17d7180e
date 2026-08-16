import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { overrideAttendance } from "@/lib/dh-extras.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operational/attendance")({
  component: AttendancePage,
});

async function fetchRecent() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id, present, attendance_timestamp, schedule_id, students(full_name, registration_number), schedules(module_code, module_name, date)")
    .gte("attendance_timestamp", since)
    .order("attendance_timestamp", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function AttendancePage() {
  const qc = useQueryClient();
  const overrideFn = useServerFn(overrideAttendance);
  const { data: rows } = useQuery({ queryKey: ["dh-attendance-recent"], queryFn: fetchRecent, staleTime: 15000 });

  const [target, setTarget] = useState<any | null>(null);
  const [comment, setComment] = useState("");

  const mut = useMutation({
    mutationFn: () => overrideFn({ data: {
      attendance_log_id: target.id,
      new_value: !target.present,
      audit_comment: comment,
    }}),
    onSuccess: () => {
      toast.success("Override recorded");
      setTarget(null); setComment("");
      qc.invalidateQueries({ queryKey: ["dh-attendance-recent"] });
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Attendance Overrides</h1>
        <p className="text-sm text-muted-foreground">Recent records (last 24h). Overrides require an audit comment and are time-locked.</p>
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Recent Logs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(rows ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.students?.full_name} · {r.students?.registration_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.schedules?.module_code} · {r.schedules?.date} · {new Date(r.attendance_timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.present ? "default" : "secondary"}>{r.present ? "Present" : "Absent"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setTarget(r)}>Override</Button>
                </div>
              </div>
            ))}
            {!rows?.length && <p className="px-6 py-6 text-sm text-muted-foreground">No recent attendance records.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override attendance</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-3 text-sm">
              <p>
                Flip <b>{target.students?.full_name}</b> from{" "}
                <Badge variant={target.present ? "default" : "secondary"}>{target.present ? "Present" : "Absent"}</Badge>
                {" → "}
                <Badge variant={!target.present ? "default" : "secondary"}>{!target.present ? "Present" : "Absent"}</Badge>
              </p>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Required audit comment (min 3 chars)" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={() => mut.mutate()} disabled={comment.trim().length < 3 || mut.isPending}>
              Confirm override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}