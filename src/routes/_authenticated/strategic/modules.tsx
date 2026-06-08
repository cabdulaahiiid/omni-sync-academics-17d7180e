import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listModules, bulkInsertModules } from "@/lib/modules.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { DownloadTemplateButton } from "@/components/download-template-button";
import { MODULES_TEMPLATE } from "@/lib/xlsx-templates";

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
  const [parsed, setParsed] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
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
        setParsed(rows);
        toast.success(`Parsed ${rows.length} rows`);
      } catch {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const uploadMut = useMutation({
    mutationFn: () => bulk({ data: { rows: parsed } }),
    onSuccess: (r) => {
      toast.success(`Inserted ${r.inserted} modules${r.errors.length ? ` · ${r.errors.length} errors` : ""}`);
      if (r.errors.length) {
        r.errors.slice(0, 5).forEach((e) => toast.error(`Row ${e.row}: ${e.reason}`));
      }
      qc.invalidateQueries({ queryKey: ["modules"] });
      setOpen(false); setParsed([]); setFileName("");
    },
    onError: (e: Error) => toast.error(e.message),
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Upload className="mr-2 h-4 w-4" /> Bulk upload</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Bulk upload modules</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Required columns: <code>code, name, department_name, level_name, type, qualifications, total_hours, total_sessions</code>.
                  Use comma-separated values for qualifications. Type ∈ Theory | Practical | Both.
                </div>
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="block w-full text-sm" />
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
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Level</TableHead><TableHead>Type</TableHead><TableHead>Hours</TableHead><TableHead>Sessions</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && !modules?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No modules yet. Upload your registry to get started.</TableCell></TableRow>}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}