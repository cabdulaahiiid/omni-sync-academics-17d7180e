import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDepartments, upsertDepartment, deleteDepartment } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/departments")({
  component: DepartmentsPage,
});

type Dept = { id: string; name: string; description: string | null; status: "ACTIVE" | "SUSPENDED" };

function DepartmentsPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listDepartments);
  const upsert = useServerFn(upsertDepartment);
  const del = useServerFn(deleteDepartment);
  const { data: rows, isLoading } = useQuery({ queryKey: ["departments"], queryFn: () => list(), enabled: authReady && hasSession, throwOnError: false });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED">("ACTIVE");

  const saveMut = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, name, description, status } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["departments"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["departments"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground">Manage institutional departments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setName(""); setDescription(""); setStatus("ACTIVE"); }}>
              <Plus className="mr-2 h-4 w-4" /> New department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit department" : "New department"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "ACTIVE" | "SUSPENDED")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}>{saveMut.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="w-32 text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No departments yet.</TableCell></TableRow>}
            {rows?.map((d) => {
              const dept = d as Dept;
              return (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell className="text-muted-foreground">{dept.description}</TableCell>
                  <TableCell><Badge variant={dept.status === "ACTIVE" ? "default" : "secondary"}>{dept.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(dept); setName(dept.name); setDescription(dept.description ?? ""); setStatus(dept.status); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${dept.name}?`)) delMut.mutate(dept.id); }}><Trash2 className="h-4 w-4" /></Button>
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