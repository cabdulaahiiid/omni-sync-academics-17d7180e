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
import { isValidEtPhone, PHONE_ERROR } from "@/lib/phone";
import { useMasterData } from "@/hooks/use-master-data";
import { GENDER_OPTIONS, GUARDIAN_RELATIONSHIP_OPTIONS, normalizeGender } from "@/lib/master-data";
import { downloadCsv, downloadPdf } from "@/lib/report-export";
import type { ReportResult } from "@/lib/reports.functions";
import { FileDown, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/operational/students")({
  component: StudentsHub,
});

function StudentsHub() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyStudents);
  const createFn = useServerFn(createStudent);
  const bulkFn = useServerFn(bulkInsertStudents);
  const lsFn = useServerFn(listDeptLevelsSections);
  const { data: roster, isLoading } = useQuery({ queryKey: ["dh-students"], queryFn: () => listFn() });
  const students = roster?.students ?? [];
  const canViewGuardian = roster?.canViewGuardian ?? false;
  const { data: ls } = useQuery({ queryKey: ["dh-levels-sections"], queryFn: () => lsFn() });

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({
    registration_number: "", full_name: "", level_id: "", section_id: "", gender: "", telephone: "",
    parent_guardian_name: "", parent_guardian_telephone: "", parent_guardian_relationship: "",
  });
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [bulkLevelId, setBulkLevelId] = useState<string>("");
  const [bulkSectionId, setBulkSectionId] = useState<string>("");

  const levels = ls?.levels ?? [];
  const sections = (ls?.sections ?? []).filter((s) => !bulkLevelId || s.level_id === bulkLevelId);
  // Live master data for the registration form (dependent Level → Section).
  const md = useMasterData();
  const formLevels = levels.length ? levels : md.levels;
  const formSections = (ls?.sections ?? md.sections).filter(
    (s: any) => !form.level_id || s.level_id === form.level_id,
  );
  const levelName = (formLevels as any[]).find((l) => l.id === form.level_id)?.name ?? "";
  const sectionName = (formSections as any[]).find((s) => s.id === form.section_id)?.name ?? "";
  const bulkLevelName = levels.find((l) => l.id === bulkLevelId)?.name ?? "";
  const bulkSectionName = sections.find((s) => s.id === bulkSectionId)?.name ?? "";
  const phoneInvalid = !isValidEtPhone(form.parent_guardian_telephone);
  const studentPhoneInvalid = !isValidEtPhone(form.telephone);

  function buildReport(): ReportResult {
    const columns = [
      { key: "registration_number", label: "Student ID" },
      { key: "full_name", label: "Name" },
      { key: "level_name", label: "Level" },
      { key: "section_name", label: "Section" },
      { key: "status", label: "Status" },
      ...(canViewGuardian
        ? [
            { key: "parent_guardian_name", label: "Parent/Guardian Name" },
            { key: "parent_guardian_telephone", label: "Parent/Guardian Telephone" },
            { key: "parent_guardian_relationship", label: "Relationship" },
          ]
        : []),
    ];
    return {
      key: "students_roster",
      title: "Students Roster",
      columns,
      rows: students.map((s: any) =>
        Object.fromEntries(columns.map((c) => [c.key, (s as any)[c.key] ?? ""])),
      ),
      summary: [{ label: "Total students", value: students.length }],
      generated_at: new Date().toISOString(),
      filters: {},
    };
  }

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          registration_number: form.registration_number,
          full_name: form.full_name,
          level_name: levelName,
          section_name: sectionName,
          gender: (form.gender || null) as "Male" | "Female" | null,
          telephone: form.telephone || null,
          parent_guardian_name: form.parent_guardian_name || null,
          parent_guardian_telephone: form.parent_guardian_telephone || null,
          parent_guardian_relationship: (form.parent_guardian_relationship || null) as any,
        },
      }),
    onSuccess: () => {
      toast.success("Student registered");
      setOpen(false);
      setForm({
        registration_number: "", full_name: "", level_id: "", section_id: "", gender: "", telephone: "",
        parent_guardian_name: "", parent_guardian_telephone: "", parent_guardian_relationship: "",
      });
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
        gender: normalizeGender(r.gender),
        telephone: r.telephone || r.phone || null,
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
                <div>
                  <Label>Level</Label>
                  <Select value={form.level_id} onValueChange={(v) => setForm({ ...form, level_id: v, section_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      {(formLevels as any[]).map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.display_name || l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section</Label>
                  <Select value={form.section_id} onValueChange={(v) => setForm({ ...form, section_id: v })} disabled={!form.level_id}>
                    <SelectTrigger><SelectValue placeholder={form.level_id ? "Select section" : "Select level first"} /></SelectTrigger>
                    <SelectContent>
                      {(formSections as any[]).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Student Telephone</Label>
                  <Input type="tel" placeholder="e.g. +251 91 XXX XXXX" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                  {studentPhoneInvalid && <p className="mt-1 text-xs text-destructive">{PHONE_ERROR}</p>}
                </div>
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-slate-800">Parent / Guardian Contact</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Parent/Guardian Name</Label>
                  <Input placeholder="e.g. Ahmed Hassan" value={form.parent_guardian_name} onChange={(e) => setForm({ ...form, parent_guardian_name: e.target.value })} />
                </div>
                <div>
                  <Label>Telephone Number</Label>
                  <Input type="tel" placeholder="e.g. +251 91 XXX XXXX" value={form.parent_guardian_telephone} onChange={(e) => setForm({ ...form, parent_guardian_telephone: e.target.value })} />
                  {phoneInvalid && <p className="mt-1 text-xs text-destructive">{PHONE_ERROR}</p>}
                </div>
                <div>
                  <Label>Relationship to Student</Label>
                  <Select value={form.parent_guardian_relationship} onValueChange={(v) => setForm({ ...form, parent_guardian_relationship: v })}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      {GUARDIAN_RELATIONSHIP_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()}
                disabled={!form.registration_number || !form.full_name || !form.level_id || !form.section_id || !form.telephone || studentPhoneInvalid || phoneInvalid || create.isPending}>
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Roster ({students.length})</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCsv(buildReport())} disabled={!students.length}>
              <FileDown className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPdf(buildReport())} disabled={!students.length}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Level</TableHead><TableHead>Section</TableHead>
              {canViewGuardian && <><TableHead>Guardian</TableHead><TableHead>Telephone</TableHead><TableHead>Relationship</TableHead></>}
              <TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={canViewGuardian ? 8 : 5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && !students.length && <TableRow><TableCell colSpan={canViewGuardian ? 8 : 5} className="text-center text-muted-foreground">No students yet.</TableCell></TableRow>}
              {students.map((s: any) => (
                <TableRow key={s.id} onClick={() => setDetail(s)} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{s.registration_number}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>{s.level_name}</TableCell>
                  <TableCell>{s.section_name}</TableCell>
                  {canViewGuardian && <>
                    <TableCell>{s.parent_guardian_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.parent_guardian_telephone || "—"}</TableCell>
                    <TableCell>{s.parent_guardian_relationship || "—"}</TableCell>
                  </>}
                  <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Student details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Student ID</p><p className="font-mono">{detail.registration_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Full name</p><p className="font-medium">{detail.full_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Level</p><p>{detail.level_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Section</p><p>{detail.section_name}</p></div>
                <div><p className="text-xs text-muted-foreground">Gender</p><p>{detail.gender || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p>{detail.status}</p></div>
              </div>
              {canViewGuardian && (
                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-semibold">Parent / Guardian Contact</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs text-muted-foreground">Name</p><p>{detail.parent_guardian_name || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Telephone</p><p className="font-mono">{detail.parent_guardian_telephone || "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Relationship</p><p>{detail.parent_guardian_relationship || "—"}</p></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}