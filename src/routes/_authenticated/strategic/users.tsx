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
import { UserPlus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUploader } from "@/components/avatar-uploader";
import { adminSetUserAvatar, adminChangeUserPassword } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/strategic/users")({
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllUsers);
  const createFn = useServerFn(createUserAccount);
  const toggleFn = useServerFn(toggleBypassGeofence);
  const deptsFn = useServerFn(listDepartments);
  const setAvatarFn = useServerFn(adminSetUserAvatar);
  const setPasswordFn = useServerFn(adminChangeUserPassword);
  const { data: users, isLoading } = useQuery({ queryKey: ["all-users"], queryFn: () => listFn() });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => deptsFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "T" as "MA" | "DH" | "T", department_id: "" });
  const [avatarPath, setAvatarPath] = useState("");

  const [manage, setManage] = useState<null | { id: string; name: string; email: string; avatar_url: string | null }>(null);
  const [newAvatarPath, setNewAvatarPath] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, department_id: form.department_id || null, avatar_path: avatarPath } }),
    onSuccess: () => {
      toast.success(`User created — ${form.email}`);
      setOpen(false);
      setForm({ full_name: "", email: "", password: "", role: "T", department_id: "" });
      setAvatarPath("");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (vars: { user_id: string; bypass: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAvatar = useMutation({
    mutationFn: (vars: { user_id: string; avatar_path: string }) => setAvatarFn({ data: vars }),
    onSuccess: () => { toast.success("Photo updated"); setNewAvatarPath(""); qc.invalidateQueries({ queryKey: ["all-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const savePassword = useMutation({
    mutationFn: (vars: { user_id: string; new_password: string }) => setPasswordFn({ data: vars }),
    onSuccess: () => { toast.success("Password reset"); setNewPassword(""); },
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
              <AvatarUploader ownerId="pending" required onUploaded={(p) => setAvatarPath(p)} />
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
                disabled={!form.email || !form.full_name || form.password.length < 8 || (form.role !== "MA" && !form.department_id) || !avatarPath || create.isPending}>
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
            <TableHeader><TableRow><TableHead></TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Bypass geofence</TableHead><TableHead className="w-20 text-right">Manage</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && !users?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>}
              {(users ?? []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      {u.avatar_url ? <AvatarImage src={u.avatar_url} alt="" /> : <AvatarFallback className="text-xs">{(u.full_name || u.email || "U").slice(0,2).toUpperCase()}</AvatarFallback>}
                    </Avatar>
                  </TableCell>
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setManage({ id: u.id, name: u.full_name || u.email, email: u.email, avatar_url: u.avatar_url }); setNewAvatarPath(""); setNewPassword(""); }}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!manage} onOpenChange={(o) => { if (!o) setManage(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage user — {manage?.name}</DialogTitle></DialogHeader>
          {manage && (
            <div className="space-y-5">
              <AvatarUploader
                ownerId={manage.id}
                initialUrl={manage.avatar_url}
                fallback={manage.name}
                label="Profile photo"
                onUploaded={(p) => setNewAvatarPath(p)}
              />
              <Button size="sm" disabled={!newAvatarPath || saveAvatar.isPending}
                onClick={() => saveAvatar.mutate({ user_id: manage.id, avatar_path: newAvatarPath })}>
                {saveAvatar.isPending ? "Saving…" : "Save photo"}
              </Button>

              <div className="space-y-2 border-t pt-4">
                <Label>New password (min 8 chars)</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a new password" />
                <Button size="sm" disabled={newPassword.length < 8 || savePassword.isPending}
                  onClick={() => savePassword.mutate({ user_id: manage.id, new_password: newPassword })}>
                  {savePassword.isPending ? "Updating…" : "Reset password"}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManage(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
