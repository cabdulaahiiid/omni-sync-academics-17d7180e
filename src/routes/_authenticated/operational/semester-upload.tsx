import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { uploadSemesterSchedule } from "@/lib/dh-extras.functions";
import { listSemesters } from "@/lib/ma.functions";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertTriangle, Send, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useMutation as useMutationCore } from "@tanstack/react-query";
import { dhResubmitSemester } from "@/lib/feedback.functions";
import { FeedbackChat } from "@/components/feedback-chat";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/operational/semester-upload")({
  component: SemesterUpload,
});

const REQUIRED = ["module_code","module_name","trainer_name","frequency","duration_min","section_name","level_name","venue_name","day","start_time"];

function normalizeRow(r: any) {
  return {
    module_code: String(r.module_code ?? "").trim(),
    module_name: String(r.module_name ?? "").trim(),
    trainer_name: String(r.trainer_name ?? "").trim(),
    frequency: Number(r.frequency || 1),
    duration_min: Number(r.duration_min),
    section_name: String(r.section_name ?? "").trim(),
    level_name: String(r.level_name ?? "").trim(),
    venue_name: String(r.venue_name ?? "").trim(),
    day: String(r.day ?? "").trim().toUpperCase() as "MON"|"TUE"|"WED"|"THU"|"FRI"|"SAT"|"SUN",
    start_time: String(r.start_time ?? "").trim(),
  };
}

function SemesterUpload() {
  const { data: me } = useMe();
  const [rows, setRows] = useState<ReturnType<typeof normalizeRow>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [semesterId, setSemesterId] = useState("");
  const [weeks, setWeeks] = useState(16);
  const [validated, setValidated] = useState(false);

  const semestersFn = useServerFn(listSemesters);
  const uploadFn = useServerFn(uploadSemesterSchedule);
  const resubmitFn = useServerFn(dhResubmitSemester);
  const { data: semesters } = useQuery({ queryKey: ["semesters"], queryFn: () => semestersFn(), staleTime: 60000 });

  const selectedSem = (semesters ?? []).find((s: any) => s.id === semesterId);
  const isFeedbackActive = selectedSem?.distribution_status === "FEEDBACK_ACTIVE";

  const resubmit = useMutationCore({
    mutationFn: () => resubmitFn({ data: { semester_id: semesterId } }),
    onSuccess: () => toast.success("Resubmitted to Admin"),
    onError: (e: Error) => toast.error(e.message),
  });

  const validateMut = useMutation({
    mutationFn: () => uploadFn({ data: {
        semester_id: semesterId,
        department_id: me!.profile!.department_id!,
        rows,
        weeks,
        validate_only: true,
      }}),
    onSuccess: (r) => {
      if (r.ok) { setValidated(true); toast.success("Validation passed. No conflicts detected."); }
      else { setValidated(false); toast.error(`Validation failed: ${r.errors.length} errors, ${r.conflicts.length} conflicts.`); }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDraftMut = useMutation({
    mutationFn: () => uploadFn({ data: {
        semester_id: semesterId,
        department_id: me!.profile!.department_id!,
        rows,
        weeks,
        validate_only: false,
      }}),
    onSuccess: (r) => {
      if (r.ok) toast.success(`Saved ${r.created} draft sessions. Open Drafts to request approval.`);
      else toast.error("Save blocked by conflicts. Re-validate.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastResult = saveDraftMut.data ?? validateMut.data;

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!raw.length) { toast.error("Empty sheet"); return; }
    const missing = REQUIRED.filter((k) => !(k in raw[0]));
    if (missing.length) { toast.error(`Missing columns: ${missing.join(", ")}`); return; }
    setRows(raw.map(normalizeRow));
    setFileName(file.name);
    setValidated(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Semester Upload</h1>
        <p className="text-sm text-muted-foreground">Upload an Excel (.xlsx) timetable. Validation blocks any trainer/venue/section double-booking before saving as drafts.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
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
              onChange={(e) => { setWeeks(Number(e.target.value)); setValidated(false); }}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Excel timetable</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-accent/40">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName ? <span>{fileName} ({rows.length} rows)</span> : <span>Click to upload .xlsx (columns: {REQUIRED.join(", ")})</span>}
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => validateMut.mutate()}
              disabled={!semesterId || rows.length === 0 || validateMut.isPending}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {validateMut.isPending ? "Validating…" : "Validate (check conflicts)"}
            </Button>
            <Button onClick={() => saveDraftMut.mutate()}
              disabled={!validated || saveDraftMut.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {saveDraftMut.isPending ? "Saving…" : "Save as Draft"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {semesterId && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(isFeedbackActive || selectedSem?.distribution_status === "PENDING_MA" || selectedSem?.distribution_status === "PUBLISHED") && (
            <FeedbackChat semesterId={semesterId} title="Conversation with Admin" />
          )}
          {isFeedbackActive && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Resubmit</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">Feedback active. Make edits in Drafts, then resubmit.</p>
                <Button onClick={() => resubmit.mutate()} disabled={resubmit.isPending} className="w-full">
                  <Send className="mr-2 h-4 w-4" /> {resubmit.isPending ? "Submitting…" : "Resubmit to Admin"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {lastResult && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Validation report</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {lastResult.ok ? <CheckCircle2 className="h-4 w-4 text-emerald" /> : <AlertTriangle className="h-4 w-4 text-amber" />}
              <span>{lastResult.total_rows} rows × {weeks} weeks = {lastResult.total_rows * weeks} sessions. {lastResult.created ? <>Created <b>{lastResult.created}</b>.</> : null}</span>
            </div>
            {lastResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber" /> Errors</p>
                {lastResult.errors.map((e: any, i: number) => (
                  <Badge key={i} variant="destructive" className="mr-1 text-[10px]">Row {e.row + 1}: {e.reason}</Badge>
                ))}
              </div>
            )}
            {lastResult.conflicts?.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber" /> Conflicts ({lastResult.conflicts.length})</p>
                <div className="flex flex-wrap gap-1">
                  {lastResult.conflicts.slice(0, 40).map((c: any, i: number) => (
                    <Badge key={i} variant="destructive" className="text-[10px]">
                      {c.kind} · {c.date} · row {c.row_a + 1}{c.row_b >= 0 ? ` vs ${c.row_b + 1}` : " vs existing"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}