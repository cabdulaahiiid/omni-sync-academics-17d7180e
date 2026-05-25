import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/departments")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
    status: s.status === "ACTIVE" || s.status === "SUSPENDED" ? s.status : undefined,
  }),
  component: DepartmentsPage,
});

type Dept = { id: string; name: string; description: string | null; status: "ACTIVE" | "SUSPENDED" };

function DepartmentsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const filterQ = search.q ?? "";
  const filterStatus = search.status;
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

  const filteredRows = (rows ?? []).filter((d: any) => {
    if (filterStatus && d.status !== filterStatus) return false;
    if (filterQ && !d.name.toLowerCase().includes(filterQ.toLowerCase())) return false;
    return true;
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
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search…"
          value={filterQ}
          onChange={(e) =>
            navigate({ search: (prev) => ({ ...prev, q: e.target.value || undefined }), replace: true })
          }
          className="max-w-xs"
        />
        <Select
          value={filterStatus ?? "all"}
          onValueChange={(v) =>
            navigate({ search: (prev) => ({ ...prev, status: v === "all" ? undefined : (v as "ACTIVE" | "SUSPENDED") }), replace: true })
          }
        >
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="w-40 text-right">Actions</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && filteredRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No departments match.</TableCell></TableRow>}
            {filteredRows.map((d) => {
              const dept = d as Dept;
              return (
                <TableRow
                  key={dept.id}
                  className="cursor-pointer hover:bg-accent/40"
                  onClick={() => navigate({ to: "/strategic/departments/$id", params: { id: dept.id } })}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      {dept.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dept.description}</TableCell>
                  <TableCell><Badge variant={dept.status === "ACTIVE" ? "default" : "secondary"}>{dept.status}</Badge></TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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