import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyStudents, createStudent, bulkInsertStudents, listDeptLevelsSections } from "@/lib/students.functions";
import { CsvDropzone, type ParsedRow } from "@/components/csv-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { DownloadTemplateButton } from "@/components/download-template-button";
import { STUDENTS_ROSTER_TEMPLATE } from "@/lib/xlsx-templates";

export const Route = createFileRoute("/_authenticated/operational/students")({
  component: StudentsHub,
});

function StudentsHub() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyStudents);
  const createFn = useServerFn(createStudent);
  const bulkFn = useServerFn(bulkInsertStudents);
  const lsFn = useServerFn(listDeptLevelsSections);
  const { data: students, isLoading } = useQuery({ queryKey: ["dh-students"], queryFn: () => listFn() });
  const { data: ls } = useQuery({ queryKey: ["dh-levels-sections"], queryFn: () => lsFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ registration_number: "", full_name: "", level_name: "", section_name: "", gender: "" });
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [bulkLevelId, setBulkLevelId] = useState<string>("");
  const [bulkSectionId, setBulkSectionId] = useState<string>("");

  const levels = ls?.levels ?? [];
  const sections = (ls?.sections ?? []).filter((s) => !bulkLevelId || s.level_id === bulkLevelId);
  const bulkLevelName = levels.find((l) => l.id === bulkLevelId)?.name ?? "";
  const bulkSectionName = sections.find((s) => s.id === bulkSectionId)?.name ?? "";

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, gender: form.gender || null } }),
    onSuccess: () => {
      toast.success("Student registered");
      setOpen(false);
      setForm({ registration_number: "", full_name: "", level_name: "", section_name: "", gender: "" });
      qc.invalidateQueries({ queryKey: ["dh-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: () => {
      if (!bulkLevelName || !bulkSectionName) throw new Error("Select level and section first");
      const rows = csvRows.map((r) => ({
        registration_number: r.student_id_code || r.registration_number || "",
        full_name: r.full_name || "",
        level_name: bulkLevelName,
        section_name: bulkSectionName,
        gender: r.gender || null,
      })).filter((r) => r.registration_number && r.full_name);
      return bulkFn({ data: { rows } });
    },
    onSuccess: (r) => {
      toast.success(`Inserted ${r.inserted} students${r.errors.length ? ` · ${r.errors.length} errors` : ""}`);
      r.errors.slice(0, 5).forEach((e) => toast.error(`Row ${e.row}: ${e.reason}`));
      setCsvRows([]); setCsvName("");
      qc.invalidateQueries({ queryKey: ["dh-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students Hub</h1>
          <p className="text-sm text-muted-foreground">Department roster. Register one student or bulk-import a CSV.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Register single student</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register student</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Student ID code</Label><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></div>
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Level</Label><Input placeholder="e.g. I" value={form.level_name} onChange={(e) => setForm({ ...form, level_name: e.target.value })} /></div>
                <div><Label>Section</Label><Input placeholder="e.g. Section A" value={form.section_name} onChange={(e) => setForm({ ...form, section_name: e.target.value })} /></div>
              </div>
              <div><Label>Gender (optional)</Label><Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()}
                disabled={!form.registration_number || !form.full_name || !form.level_name || !form.section_name || create.isPending}>
                {create.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Bulk roster upload</CardTitle>
          <DownloadTemplateButton spec={STUDENTS_ROSTER_TEMPLATE} label="Sample template" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Level</Label>
              <Select value={bulkLevelId} onValueChange={(v) => { setBulkLevelId(v); setBulkSectionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Select value={bulkSectionId} onValueChange={setBulkSectionId} disabled={!bulkLevelId}>
                <SelectTrigger><SelectValue placeholder={bulkLevelId ? "Select section" : "Pick level first"} /></SelectTrigger>
                <SelectContent>
                  {sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CsvDropzone
            helpText="Required columns: student_id_code, full_name (optional: gender). Level and section come from the selectors above."
            sampleHeaders={["student_id_code", "full_name", "gender"]}
            onParsed={(rows, name) => { setCsvRows(rows); setCsvName(name); toast.success(`Parsed ${rows.length} rows`); }}
          />
          {csvRows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{csvName} · {csvRows.length} rows ready</p>
              <Button onClick={() => bulk.mutate()} disabled={bulk.isPending || !bulkLevelId || !bulkSectionId}>
                {bulk.isPending ? "Importing…" : `Process and import (${csvRows.length})`}
              </Button>
            </div>
          )}
          {csvRows.length > 0 && (!bulkLevelId || !bulkSectionId) && (
            <p className="text-xs text-amber-600">Select level and section to enable import.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Roster ({students?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Section</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && !students?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No students yet.</TableCell></TableRow>}
              {(students ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.registration_number}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.level_name}</TableCell>
                  <TableCell>{s.section_name}</TableCell>
                  <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}