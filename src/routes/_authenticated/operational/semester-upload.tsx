import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { uploadSemesterSchedule } from "@/lib/dh-extras.functions";
import { listSemesters } from "@/lib/ma.functions";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { useMutation as useMutationCore } from "@tanstack/react-query";
import { dhResubmitSemester } from "@/lib/feedback.functions";
import { FeedbackChat } from "@/components/feedback-chat";

export const Route = createFileRoute("/_authenticated/operational/semester-upload")({
  component: SemesterUpload,
});

const SAMPLE = `module_code,module_name,trainer_name,frequency,duration_min,section_name,level_name,venue_name,day,start_time
ICT201,Web Development,David Kayitare,1,120,ICT-IV-A,IV,Lab A,MON,09:00
ICT202,Networking,David Kayitare,1,120,ICT-IV-A,IV,Lab A,WED,09:00`;

function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()!.split(",").map((s) => s.trim());
  return lines.map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cols[i] ?? ""));
    return {
      module_code: row.module_code,
      module_name: row.module_name,
      trainer_name: row.trainer_name,
      frequency: Number(row.frequency || 1),
      duration_min: Number(row.duration_min),
      section_name: row.section_name,
      level_name: row.level_name,
      venue_name: row.venue_name,
      day: row.day as "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN",
      start_time: row.start_time,
    };
  });
}

function SemesterUpload() {
  const { data: me } = useMe();
  const [csv, setCsv] = useState(SAMPLE);
  const [semesterId, setSemesterId] = useState("");
  const [weeks, setWeeks] = useState(16);

  const semestersFn = useServerFn(listSemesters);
  const uploadFn = useServerFn(uploadSemesterSchedule);
  const resubmitFn = useServerFn(dhResubmitSemester);
  const { data: semesters } = useQuery({ queryKey: ["semesters"], queryFn: () => semestersFn(), staleTime: 60000 });

  const selectedSem = (semesters ?? []).find((s: any) => s.id === semesterId);
  const isRejected = selectedSem?.status === "DRAFT" || selectedSem?.status === "REJECTED";

  const resubmit = useMutationCore({
    mutationFn: () => resubmitFn({ data: { semester_id: semesterId } }),
    onSuccess: () => toast.success("Resubmitted to Admin"),
    onError: (e: Error) => toast.error(e.message),
  });

  const mut = useMutation({
    mutationFn: () => {
      const rows = parseCSV(csv);
      return uploadFn({ data: {
        semester_id: semesterId,
        department_id: me!.profile!.department_id!,
        rows,
        weeks,
      }});
    },
    onSuccess: (r) => toast.success(`${r.created} schedules created (${r.errors.length} errors)`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Semester Upload</h1>
        <p className="text-sm text-muted-foreground">Paste CSV rows. Slicing engine generates {weeks} weekly schedules.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium">Semester</label>
            <Select value={semesterId} onValueChange={setSemesterId}>
              <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
              <SelectContent>
                {(semesters ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Weeks</label>
            <input type="number" min={1} max={20} value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => mut.mutate()}
              disabled={!semesterId || !me?.profile?.department_id || mut.isPending}
              className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {mut.isPending ? "Slicing…" : "Upload & Slice"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {semesterId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <FeedbackChat semesterId={semesterId} title="Conversation with Admin" />
          {isRejected && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Resubmit</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">After applying the Admin's corrections, resubmit the semester for approval.</p>
                <Button onClick={() => resubmit.mutate()} disabled={resubmit.isPending} className="w-full">
                  <Send className="mr-2 h-4 w-4" /> {resubmit.isPending ? "Submitting…" : "Resubmit to Admin"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">CSV Rows</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={12} value={csv} onChange={(e) => setCsv(e.target.value)}
            className="font-mono text-xs" />
        </CardContent>
      </Card>

      {mut.data && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald" />
              <span>Created <b>{mut.data.created}</b> of {mut.data.total_rows * weeks} possible schedules</span>
            </div>
            {mut.data.errors.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber" /> Errors</p>
                {mut.data.errors.map((e, i) => (
                  <Badge key={i} variant="destructive" className="mr-1 text-[10px]">Row {e.row + 1}: {e.reason}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}