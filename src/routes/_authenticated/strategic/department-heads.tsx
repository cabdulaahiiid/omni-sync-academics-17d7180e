import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDepartmentHeads, createDepartmentHead, revokeDepartmentHead } from "@/lib/dh.functions";
import { listDepartments } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/department-heads")({
  component: DHPage,
});

function DHPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const canQuery = authReady && hasSession;
  const list = useServerFn(listDepartmentHeads);
  const create = useServerFn(createDepartmentHead);
  const revoke = useServerFn(revokeDepartmentHead);
  const listD = useServerFn(listDepartments);
  const { data: rows, isLoading } = useQuery({ queryKey: ["dh"], queryFn: () => list(), enabled: canQuery, throwOnError: false });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => listD(), enabled: canQuery, throwOnError: false });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [credentials, setCredentials] = useState<{ email: string; temp_password: string } | null>(null);

  const createMut = useMutation({
    mutationFn: () => create({ data: { email, full_name: fullName, department_id: deptId } }),
    onSuccess: (r) => {
      toast.success("Department Head created");
      setCredentials({ email: r.email, temp_password: r.temp_password });
      setOpen(false); setEmail(""); setFullName(""); setDeptId("");
      qc.invalidateQueries({ queryKey: ["dh"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Revoked"); qc.invalidateQueries({ queryKey: ["dh"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Department Heads</h1>
          <p className="text-sm text-muted-foreground">Provision DH accounts and assign departments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create DH account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Department Head account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(depts ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={!email || !fullName || !deptId || createMut.isPending}>
                {createMut.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {credentials && (
        <Card className="border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Account created — share these credentials securely</p>
          <div className="mt-2 flex items-center gap-2 rounded bg-background p-2 font-mono text-xs">
            <span>{credentials.email}</span><span className="text-muted-foreground">/</span><span>{credentials.temp_password}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { navigator.clipboard.writeText(`${credentials.email} / ${credentials.temp_password}`); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCredentials(null)}>Dismiss</Button>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead><TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && !rows?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No DH accounts yet.</TableCell></TableRow>}
            {rows?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell>{r.department_name}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Revoke ${r.full_name}?`)) revokeMut.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}