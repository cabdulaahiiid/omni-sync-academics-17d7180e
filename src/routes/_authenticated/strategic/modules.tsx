import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listModules, bulkInsertModules, createModule } from "@/lib/modules.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Plus, ListTree } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DownloadTemplateButton } from "@/components/download-template-button";
import { MODULES_TEMPLATE } from "@/lib/xlsx-templates";
import { useMasterData, useInvalidateMasterData } from "@/hooks/use-master-data";
import { MODULE_TYPE_OPTIONS } from "@/lib/master-data";
import { ModulePracticalTemplateDialog } from "@/components/practical/module-practical-template-dialog";

export const Route = createFileRoute("/_authenticated/strategic/modules")({
  component: ModulesPage,
});

type Row = {
  code: string; name: string; department_name: string; level_name: string;
  type: "Theory" | "Practical" | "Both"; qualifications: string[];
  total_hours: number; total_sessions: number;
};

function ModulesPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listModules);
  const bulk = useServerFn(bulkInsertModules);
  const { data: modules, isLoading } = useQuery({ queryKey: ["modules"], queryFn: () => list(), enabled: authReady && hasSession, throwOnError: false });
  const [open, setOpen] = useState(false);
  const [templateFor, setTemplateFor] = useState<{ id: string; code: string; name: string; type: string } | null>(null);
  const [parsed, setParsed] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const md = useMasterData();
  const invalidateMaster = useInvalidateMasterData();
  const createFn = useServerFn(createModule);
  const [addOpen, setAddOpen] = useState(false);
  const emptyForm = {
    code: "", name: "", department_id: "", level_id: "",
    type: "Both" as "Theory" | "Practical" | "Both",
    total_hours: 0, total_sessions: 0,
  };
  const [form, setForm] = useState(emptyForm);
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { ...form, qualifications: [] } }),
    onSuccess: () => {
      toast.success("Module created");
      setAddOpen(false); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["modules"] });
      invalidateMaster();
    },
    onError: (e: Error) => toastError(e),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("This file type cannot be imported", {
        description: `"${file.name}" is a .${ext} file. Fix: download the template on this screen and upload it as .xlsx, .xls or .csv.`,
        duration: 10000,
      });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!json.length) {
          toast.error("The sheet has no data rows", {
            description: `"${file.name}" contains only headers. Fix: add at least one module row under the header line and upload again.`,
            duration: 10000,
          });
          return;
        }
        const headers = Object.keys(json[0]).map((h) => h.trim().toLowerCase());
        const required = ["code", "name", "department_name", "level_name"];
        const missing = required.filter((h) => !headers.includes(h));
        if (missing.length) {
          toast.error("The file headers do not match the template", {
            description: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Found: ${headers.join(", ")}. Fix: download the template, paste your data into it without renaming headers, then upload again.`,
            duration: 12000,
          });
          return;
        }
        const rows: Row[] = json.map((r) => ({
          code: String(r.code ?? "").trim(),
          name: String(r.name ?? "").trim(),
          department_name: String(r.department_name ?? "").trim(),
          level_name: String(r.level_name ?? "").trim(),
          type: (["Theory", "Practical", "Both"].includes(String(r.type)) ? r.type : "Both") as "Theory" | "Practical" | "Both",
          qualifications: String(r.qualifications ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          total_hours: Number(r.total_hours) || 0,
          total_sessions: Number(r.total_sessions) || 0,
        })).filter((r) => r.code && r.name);
        if (!rows.length) {
          toast.error("No usable rows found", {
            description: "Every row is missing a code or a name. Fix: fill both columns for each module, then upload again.",
            duration: 10000,
          });
          return;
        }
        setParsed(rows);
        setOpen(true);
        toast.success(`Parsed ${rows.length} rows`);
      } catch {
        toast.error("The file could not be read", {
          description: `"${file.name}" is not a readable workbook — it may be corrupted or still open in Excel. Fix: close it in Excel, save it again as .xlsx, then upload.`,
          duration: 10000,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const uploadMut = useMutation({
    mutationFn: () => bulk({ data: { rows: parsed } }),
    onSuccess: (r) => {
      if (r.errors.length) {
        toast.warning(`${r.inserted} of ${parsed.length} rows imported · ${r.errors.length} skipped`, {
          description: r.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.reason}`).join(" | "),
          duration: 12000,
        });
        r.errors.slice(3, 8).forEach((e) =>
          toast.error(`Row ${e.row} skipped`, { description: e.reason, duration: 10000 }),
        );
      } else {
        toast.success(`All ${r.inserted} modules imported`);
      }
      qc.invalidateQueries({ queryKey: ["modules"] });
      invalidateMaster();
      setOpen(false); setParsed([]); setFileName("");
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="text-sm text-muted-foreground">Module registry across departments and levels.</p>
        </div>
        <div className="flex gap-2">
          <DownloadTemplateButton spec={MODULES_TEMPLATE} label="Template" size="default" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> New module</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New module</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Code</Label><Input placeholder="e.g. ICT-201" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Name</Label><Input placeholder="e.g. Database Administration" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v, level_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {md.departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={form.level_id} onValueChange={(v) => setForm({ ...form, level_id: v })} disabled={!form.department_id}>
                      <SelectTrigger><SelectValue placeholder={form.department_id ? "Select level" : "Select department first"} /></SelectTrigger>
                      <SelectContent>
                        {md.levelsFor(form.department_id).map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{md.labelForLevel(l)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MODULE_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Hours</Label><Input type="number" min={0} placeholder="e.g. 60" value={form.total_hours} onChange={(e) => setForm({ ...form, total_hours: Number(e.target.value) || 0 })} /></div>
                  <div className="space-y-2"><Label>Sessions</Label><Input type="number" min={0} placeholder="e.g. 24" value={form.total_sessions} onChange={(e) => setForm({ ...form, total_sessions: Number(e.target.value) || 0 })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || !form.department_id || !form.level_id || createMut.isPending}>
                  {createMut.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Bulk upload
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Bulk upload modules</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Required columns: <code>code, name, department_name, level_name, type, qualifications, total_hours, total_sessions</code>.
                  Use comma-separated values for qualifications. Type ∈ Theory | Practical | Both.
                </div>
                {fileName && <p className="text-xs text-muted-foreground"><FileSpreadsheet className="mr-1 inline h-3 w-3" />{fileName} · {parsed.length} rows</p>}
                {parsed.length > 0 && (
                  <div className="max-h-64 overflow-auto rounded border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Dept</TableHead><TableHead>Level</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {parsed.slice(0, 50).map((r, i) => (
                          <TableRow key={i}><TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.department_name}</TableCell><TableCell>{r.level_name}</TableCell><TableCell>{r.type}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => uploadMut.mutate()} disabled={!parsed.length || uploadMut.isPending}>{uploadMut.isPending ? "Uploading…" : `Confirm upload (${parsed.length})`}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Level</TableHead><TableHead>Type</TableHead><TableHead>Hours</TableHead><TableHead>Sessions</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Practical</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && !modules?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No modules yet. Upload your registry to get started.</TableCell></TableRow>}
            {modules?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.code}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.department_name}</TableCell>
                <TableCell>{m.level_name}</TableCell>
                <TableCell><Badge variant="outline">{m.type}</Badge></TableCell>
                <TableCell>{m.total_hours}</TableCell>
                <TableCell>{m.total_sessions}</TableCell>
                <TableCell><Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                <TableCell className="text-right">
                  {m.type === "Theory" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplateFor({ id: m.id, code: m.code, name: m.name, type: m.type })}
                    >
                      <ListTree className="mr-1.5 h-3.5 w-3.5" /> Template
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ModulePracticalTemplateDialog
        module_={templateFor}
        open={!!templateFor}
        onOpenChange={(v) => { if (!v) setTemplateFor(null); }}
      />
    </div>
  );
}