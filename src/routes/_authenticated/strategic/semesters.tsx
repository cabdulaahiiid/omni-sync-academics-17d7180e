import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSemesters, upsertSemester, deleteSemester } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/semesters")({
  component: SemestersPage,
});

type Term = "Level 1" | "Level 2" | "Summer Course";
type Status = "ACTIVE" | "CLOSED" | "ARCHIVED";
type Sem = { id: string; name: string; start_date: string; end_date: string; status: string };

function parseName(name: string): { year: number; term: Term } {
  const m = name.match(/Year\s+(\d{4})\s*[–-]\s*(.+)/);
  if (m) {
    const term = m[2].trim() as Term;
    return { year: Number(m[1]), term: ["Level 1", "Level 2", "Summer Course"].includes(term) ? term : "Level 1" };
  }
  return { year: new Date().getFullYear(), term: "Level 1" };
}

function SemestersPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listSemesters);
  const upsert = useServerFn(upsertSemester);
  const del = useServerFn(deleteSemester);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => list(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sem | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [term, setTerm] = useState<Term>("Level 1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<Status>("ACTIVE");

  const saveMut = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, year, term, start_date: startDate, end_date: endDate, status } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["semesters"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["semesters"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setYear(new Date().getFullYear());
    setTerm("Level 1");
    setStartDate("");
    setEndDate("");
    setStatus("ACTIVE");
  };
  const openEdit = (s: Sem) => {
    const p = parseName(s.name);
    setEditing(s);
    setYear(p.year);
    setTerm(p.term);
    setStartDate(s.start_date);
    setEndDate(s.end_date);
    setStatus((["ACTIVE", "CLOSED", "ARCHIVED"].includes(s.status) ? s.status : "ACTIVE") as Status);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Levels</h1>
          <p className="text-sm text-muted-foreground">Create academic levels as Year + Term.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New level</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit level" : "New level"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Term</Label>
                  <Select value={term} onValueChange={(v) => setTerm(v as Term)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Level 1">Level 1</SelectItem>
                      <SelectItem value="Level 2">Level 2</SelectItem>
                      <SelectItem value="Summer Course">Summer Course</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Saved as: <span className="font-medium text-foreground">Year {year} – {term}</span></p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!startDate || !endDate || saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead>
              <TableHead>Status</TableHead><TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No levels yet.</TableCell></TableRow>}
            {rows?.map((r) => {
              const s = r as Sem;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.start_date}</TableCell>
                  <TableCell>{s.end_date}</TableCell>
                  <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${s.name}?`)) delMut.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}