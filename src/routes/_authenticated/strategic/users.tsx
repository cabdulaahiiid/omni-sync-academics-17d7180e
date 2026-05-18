import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers, createUserAccount, toggleBypassGeofence } from "@/lib/users-admin.functions";
import { listDepartments } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/users")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllUsers);
  const createFn = useServerFn(createUserAccount);
  const toggleFn = useServerFn(toggleBypassGeofence);
  const deptsFn = useServerFn(listDepartments);
  const { data: users, isLoading } = useQuery({ queryKey: ["all-users"], queryFn: () => listFn() });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => deptsFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "T" as "MA" | "DH" | "T", department_id: "" });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, department_id: form.department_id || null } }),
    onSuccess: () => {
      toast.success(`User created — ${form.email}`);
      setOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "T", department_id: "" });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { user_id: string; bypass: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Roles</h1>
          <p className="text-sm text-muted-foreground">Provision accounts and manage the geofence bypass flag.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Create user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register user account</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 characters" /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MA">Master Admin</SelectItem>
                    <SelectItem value="DH">Department Head</SelectItem>
                    <SelectItem value="T">Trainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                  <SelectTrigger><SelectValue placeholder={form.role === "MA" ? "(optional)" : "Required"} /></SelectTrigger>
                  <SelectContent>
                    {(depts ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()}
                disabled={!form.email || !form.full_name || form.password.length < 8 || (form.role !== "MA" && !form.department_id) || create.isPending}>
                {create.isPending ? "Creating…" : "Register account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">All users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Bypass geofence</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && !users?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>}
              {(users ?? []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    {u.roles.length === 0 && <Badge variant="secondary">No role</Badge>}
                    {u.roles.map((r: string) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>)}
                  </TableCell>
                  <TableCell className="text-sm">{u.department_name}</TableCell>
                  <TableCell>
                    <Switch checked={!!u.bypass_geofence}
                      onCheckedChange={(v) => toggle.mutate({ user_id: u.id, bypass: v })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
