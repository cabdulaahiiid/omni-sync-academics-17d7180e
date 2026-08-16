import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { listDepartments, listLevelsByDepartment, listSections, createSection, deleteSection } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useInvalidateMasterData } from "@/hooks/use-master-data";

export const Route = createFileRoute("/_authenticated/strategic/sections")({
  component: SectionsPage,
});

function SectionsPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const depFn = useServerFn(listDepartments);
  const lvlFn = useServerFn(listLevelsByDepartment);
  const secFn = useServerFn(listSections);
  const createFn = useServerFn(createSection);
  const delFn = useServerFn(deleteSection);

  const enabled = authReady && hasSession;
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => depFn(), enabled, throwOnError: false });
  const { data: lvlGroups } = useQuery({ queryKey: ["levels-by-dept"], queryFn: () => lvlFn(), enabled, throwOnError: false });
  const { data: sections, isLoading } = useQuery({ queryKey: ["sections"], queryFn: () => secFn(), enabled, throwOnError: false });

  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const invalidateMaster = useInvalidateMasterData();
  const [formDept, setFormDept] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formName, setFormName] = useState("");

  const filterLevels = useMemo(() => {
    if (filterDept === "all") return [];
    return lvlGroups?.find((g) => g.id === filterDept)?.levels ?? [];
  }, [filterDept, lvlGroups]);

  const formLevels = useMemo(() => {
    if (!formDept) return [];
    return lvlGroups?.find((g) => g.id === formDept)?.levels ?? [];
  }, [formDept, lvlGroups]);

  const visible = (sections ?? []).filter((s) =>
    (filterDept === "all" || s.department_id === filterDept) &&
    (filterLevel === "all" || s.level_id === filterLevel)
  );

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { department_id: formDept, level_id: formLevel, name: formName.trim() } }),
    onSuccess: () => {
      toast.success("Section created");
      qc.invalidateQueries({ queryKey: ["sections"] });
      invalidateMaster();
      setOpen(false); setFormDept(""); setFormLevel(""); setFormName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Section deleted"); qc.invalidateQueries({ queryKey: ["sections"] }); invalidateMaster(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sections</h1>
          <p className="text-sm text-muted-foreground">Group students within a department + level (e.g. A, B, C).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add section</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New section</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formDept} onValueChange={(v) => { setFormDept(v); setFormLevel(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {depts?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={formLevel} onValueChange={setFormLevel} disabled={!formDept}>
                  <SelectTrigger><SelectValue placeholder={formDept ? "Select level" : "Choose department first"} /></SelectTrigger>
                  <SelectContent>
                    {formLevels.map((l) => <SelectItem key={l.id} value={l.id}>Level {l.display_name || l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section name</Label>
                <Input placeholder="A" value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={30} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!formDept || !formLevel || !formName.trim() || createMut.isPending}
              >{createMut.isPending ? "Saving…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Label className="text-xs text-muted-foreground">Department</Label>
          <Select value={filterDept} onValueChange={(v) => { setFilterDept(v); setFilterLevel("all"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {depts?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Label className="text-xs text-muted-foreground">Level</Label>
          <Select value={filterLevel} onValueChange={setFilterLevel} disabled={filterDept === "all"}>
            <SelectTrigger><SelectValue placeholder={filterDept === "all" ? "Pick department first" : "All levels"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {filterLevels.map((l) => <SelectItem key={l.id} value={l.id}>Level {l.display_name || l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Department</TableHead><TableHead>Level</TableHead><TableHead>Section</TableHead><TableHead className="w-20"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && visible.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No sections yet.</TableCell></TableRow>}
            {visible.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.department_name}</TableCell>
                <TableCell>Level {s.level_name}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => delMut.mutate(s.id)} disabled={delMut.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}