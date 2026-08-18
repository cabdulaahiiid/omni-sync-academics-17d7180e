import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyStudents, createStudent, bulkInsertStudents, listDeptLevelsSections } from "@/lib/students.functions";
import { nextEntityCode } from "@/lib/codes.functions";
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
import { PhoneField, TextField, SelectField } from "@/components/forms/fields";
import { FormBody, FormSection, FormGrid, FormFull, FormError } from "@/components/forms/layout";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { useMasterData } from "@/hooks/use-master-data";
import { GENDER_OPTIONS, GUARDIAN_RELATIONSHIP_OPTIONS, normalizeGender } from "@/lib/master-data";
import { downloadCsv, downloadPdf } from "@/lib/report-export";
import type { ReportResult } from "@/lib/reports.functions";
import { FileDown, FileText } from "lucide-react";
import { ErrorPanel } from "@/components/forms/error-panel";
import { downloadImportErrorReport, type ImportRowError } from "@/lib/errors/import-report";

export const Route = createFileRoute("/_authenticated/operational/students")({
  component: StudentsHub,
});

function StudentsHub() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyStudents);
  const createFn = useServerFn(createStudent);
  const bulkFn = useServerFn(bulkInsertStudents);
  const lsFn = useServerFn(listDeptLevelsSections);
  const nextCodeFn = useServerFn(nextEntityCode);
  const { data: roster, isLoading } = useQuery({ queryKey: ["dh-students"], queryFn: () => listFn() });
  const students = roster?.students ?? [];
  const canViewGuardian = roster?.canViewGuardian ?? false;
  const { data: ls } = useQuery({ queryKey: ["dh-levels-sections"], queryFn: () => lsFn() });

  const [open, setOpen] = useState(false);
  const { data: nextId } = useQuery({
    queryKey: ["next-student-id"],
    queryFn: () => nextCodeFn({ data: { kind: "student" as const } }),
    staleTime: 0,
  });
  const [detail, setDetail] = useState<any | null>(null);
  const [form, setForm] = useState({
    registration_number: "", full_name: "", level_id: "", section_id: "", gender: "", telephone: "",
    parent_guardian_name: "", parent_guardian_telephone: "", parent_guardian_relationship: "",
  });
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [csvName, setCsvName] = useState("");
  const [bulkLevelId, setBulkLevelId] = useState<string>("");
  const [bulkSectionId, setBulkSectionId] = useState<string>("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; total: number; errors: ImportRowError[] } | null>(null);

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

  const create = useFormSubmit({
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
    invalidateKeys: [["dh-students"], ["contacts"], ["next-student-id"]],
    successMessage: "Student registered",
    onSaved: () => {
      setOpen(false);
      setForm({
        registration_number: "", full_name: "", level_id: "", section_id: "", gender: "", telephone: "",
        parent_guardian_name: "", parent_guardian_telephone: "", parent_guardian_relationship: "",
      });
    },
  });

  const bulk = useMutation({
    mutationFn: () => {
      const rows = csvRows.map((r) => ({
        registration_number: r.student_id_code || r.registration_number || "",
        full_name: r.full_name || r.name || "",
        level_name: r.level_name || r.level || bulkLevelName,
        section_name: r.section_name || r.section || bulkSectionName,
        gender: normalizeGender(r.gender),
        telephone: r.telephone || r.phone || null,
        parent_guardian_name: r.parent_guardian_name || r.guardian_name || null,
        parent_guardian_telephone: r.parent_guardian_telephone || r.guardian_telephone || null,
        parent_guardian_relationship:
          (r.parent_guardian_relationship || r.guardian_relationship || "") as any || null,
      })).filter((r) => r.full_name);
      if (!bulkLevelName || !bulkSectionName) {
        throw new Error("Select the Level and Section above before importing — the file does not carry them.");
      }
      if (rows.some((r) => !r.level_name || !r.section_name)) {
        throw new Error("Some rows have no level or section. Fix: pick the Level and Section above before importing.");
      }
      return bulkFn({ data: { rows } });
    },
    onSuccess: (r) => {
      const total = csvRows.length;
      setImportResult({ inserted: r.inserted, total, errors: r.errors as ImportRowError[] });
      if (r.errors.length) {
        toast.warning(`${r.inserted} of ${total} rows imported · ${r.errors.length} skipped`, {
          description: "See the list below for the exact row, the problem and how to fix it.",
          duration: 8000,
        });
      } else {
        toast.success(`All ${r.inserted} students imported`);
      }
      setCsvRows([]); setCsvName("");
      qc.invalidateQueries({ queryKey: ["dh-students"] });
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students Hub</h1>
          <p className="text-sm text-muted-foreground">Department roster. Register one student or bulk-import a CSV.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (create.isSaving) return;
            if (o && !form.registration_number && nextId?.code) {
              setForm((f) => ({ ...f, registration_number: nextId.code }));
            }
            setOpen(o);
          }}
        >
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Register single student</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Register student</DialogTitle></DialogHeader>
            <FormBody>
              <FormError message={create.error} />
              <FormSection title="Student details">
                <FormGrid>
                  <TextField
                    label="Student ID code"
                    required
                    value={form.registration_number}
                    onChange={(v) => setForm({ ...form, registration_number: v })}
                    placeholder={nextId?.code || "e.g. ICT-26-0001"}
                    hint="Generated automatically — you can change it if needed."
                  />
                  <TextField label="Full name" required value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="e.g. Abdi Mohammed Ali" />
                  <SelectField
                    label="Level" required value={form.level_id}
                    onChange={(v) => setForm({ ...form, level_id: v, section_id: "" })}
                    placeholder="Select level"
                    options={(formLevels as any[]).map((l) => ({ value: l.id, label: l.display_name || l.name }))}
                  />
                  <SelectField
                    label="Section" required value={form.section_id}
                    onChange={(v) => setForm({ ...form, section_id: v })}
                    disabled={!form.level_id}
                    placeholder={form.level_id ? "Select section" : "Select level first"}
                    options={(formSections as any[]).map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <SelectField
                    label="Gender" value={form.gender}
                    onChange={(v) => setForm({ ...form, gender: v })}
                    placeholder="Select gender"
                    options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
                  />
                  <PhoneField label="Student telephone" required value={form.telephone} onChange={(v) => setForm({ ...form, telephone: v })} hint="Ethiopian number, e.g. 0912345678" />
                </FormGrid>
              </FormSection>
              <FormSection title="Parent / Guardian contact">
                <FormGrid>
                  <TextField label="Parent/Guardian name" value={form.parent_guardian_name} onChange={(v) => setForm({ ...form, parent_guardian_name: v })} placeholder="e.g. Ahmed Hassan" />
                  <PhoneField label="Guardian telephone" required value={form.parent_guardian_telephone} onChange={(v) => setForm({ ...form, parent_guardian_telephone: v })} />
                  <FormFull>
                    <SelectField
                      label="Relationship to student" value={form.parent_guardian_relationship}
                      onChange={(v) => setForm({ ...form, parent_guardian_relationship: v })}
                      placeholder="Select relationship"
                      options={GUARDIAN_RELATIONSHIP_OPTIONS.map((r) => ({ value: r, label: r }))}
                    />
                  </FormFull>
                </FormGrid>
              </FormSection>
            </FormBody>
            <DialogFooter>
              <Button variant="outline" disabled={create.isSaving} onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.submit()}
                disabled={!form.registration_number || !form.full_name || !form.level_id || !form.section_id || !form.telephone || studentPhoneInvalid || phoneInvalid || create.isSaving}>
                {create.isSaving ? "Saving…" : "Save"}
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
          {fileError && <ErrorPanel error={fileError} />}
          <CsvDropzone
            helpText="Excel (.xlsx) or CSV. Required: full_name. Optional: student_id_code, gender, telephone, parent_guardian_name, parent_guardian_telephone, parent_guardian_relationship. Level and Section come from the selectors above."
            sampleHeaders={["student_id_code", "full_name", "gender", "telephone", "parent_guardian_name", "parent_guardian_telephone", "parent_guardian_relationship"]}
            requiredHeaders={["full_name"]}
            onFileError={(m) => {
              setFileError(m); setCsvRows([]); setCsvName("");
              toast.error("This file cannot be imported", { description: m, duration: 10000 });
            }}
            onParsed={(rows, name) => {
              setFileError(null); setImportResult(null);
              setCsvRows(rows); setCsvName(name);
              toast.success(`Parsed ${rows.length} rows`);
            }}
          />
          {importResult && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {importResult.inserted} of {importResult.total} rows imported
                  {importResult.errors.length > 0 ? ` · ${importResult.errors.length} skipped` : ""}
                </p>
                {importResult.errors.length > 0 && (
                  <Button size="sm" variant="outline"
                    onClick={() => downloadImportErrorReport("students-import-errors.xlsx", importResult.errors)}>
                    <FileDown className="mr-2 h-4 w-4" /> Download error report
                  </Button>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {importResult.errors.map((e, i) => (
                    <li key={`${e.row}-${i}`} className="flex flex-wrap gap-x-2 rounded bg-muted/50 px-2 py-1">
                      <span className="font-mono">Row {e.row}</span>
                      {e.column && <span className="font-mono text-muted-foreground">{e.column}</span>}
                      <span className="font-mono">{e.value ? `"${e.value}"` : "empty"}</span>
                      <span>{e.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
                <div><p className="text-xs text-muted-foreground">Telephone</p><p className="font-mono">{detail.telephone || "—"}</p></div>
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