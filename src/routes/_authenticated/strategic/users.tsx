import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers, createUserAccount, toggleBypassGeofence, updateUserRoles, setTrainerDepartments, setDHDepartment } from "@/lib/users-admin.functions";
import { listDepartments } from "@/lib/data.functions";
import { getGlobalConfig } from "@/lib/global-config.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const cfgFn = useServerFn(getGlobalConfig);
  const setAvatarFn = useServerFn(adminSetUserAvatar);
  const setPasswordFn = useServerFn(adminChangeUserPassword);
  const rolesFn = useServerFn(updateUserRoles);
  const trDeptFn = useServerFn(setTrainerDepartments);
  const dhDeptFn = useServerFn(setDHDepartment);
  const { data: users, isLoading } = useQuery({ queryKey: ["all-users"], queryFn: () => listFn() });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => deptsFn() });
  const { data: cfg } = useQuery({ queryKey: ["global-config"], queryFn: () => cfgFn() });
  const geoEnabled = cfg?.geofence_enabled ?? true;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "T" as "MA" | "DH" | "T", department_id: "" });
  const [avatarPath, setAvatarPath] = useState("");

  const [manage, setManage] = useState<null | { id: string; name: string; email: string; avatar_url: string | null; roles: string[]; department_ids: string[]; primary_department_id: string | null; department_id: string | null }>(null);
  const [newAvatarPath, setNewAvatarPath] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editRoles, setEditRoles] = useState<("MA" | "DH" | "T")[]>([]);
  const [editTrainerDepts, setEditTrainerDepts] = useState<string[]>([]);
  const [editPrimary, setEditPrimary] = useState<string>("");
  const [editDHDept, setEditDHDept] = useState<string>("");

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

  const saveAccess = useMutation({
    mutationFn: async () => {
      if (!manage) return;
      await rolesFn({ data: { user_id: manage.id, roles: editRoles } });
      if (editRoles.includes("T") && editTrainerDepts.length) {
        await trDeptFn({ data: {
          user_id: manage.id,
          department_ids: editTrainerDepts,
          primary_department_id: editPrimary || editTrainerDepts[0],
        }});
      }
      if (editRoles.includes("DH") && editDHDept) {
        await dhDeptFn({ data: { user_id: manage.id, department_id: editDHDept } });
      }
    },
    onSuccess: () => {
      toast.success("Roles & departments updated");
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
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
                    <div className="flex items-center gap-2">
                      <Switch checked={geoEnabled ? !!u.bypass_geofence : true} disabled={!geoEnabled}
                        onCheckedChange={(v) => toggle.mutate({ user_id: u.id, bypass: v })} />
                      {!geoEnabled && <span className="text-xs text-muted-foreground">global off</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setManage({
                        id: u.id, name: u.full_name || u.email, email: u.email, avatar_url: u.avatar_url,
                        roles: u.roles ?? [], department_ids: u.department_ids ?? [],
                        primary_department_id: u.primary_department_id ?? null,
                        department_id: u.department_id ?? null,
                      });
                      setNewAvatarPath(""); setNewPassword("");
                      setEditRoles((u.roles ?? []).filter((r: string) => r === "MA" || r === "DH" || r === "T") as any);
                      setEditTrainerDepts(u.department_ids?.length ? u.department_ids : (u.department_id ? [u.department_id] : []));
                      setEditPrimary(u.primary_department_id ?? u.department_id ?? "");
                      setEditDHDept(u.department_id ?? "");
                    }}>
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

              <div className="space-y-3 border-t pt-4">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-4">
                  {(["MA", "DH", "T"] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editRoles.includes(r)}
                        onCheckedChange={(v) => {
                          setEditRoles((prev) => v ? Array.from(new Set([...prev, r])) : prev.filter((x) => x !== r));
                        }}
                      />
                      {r === "MA" ? "Master Admin" : r === "DH" ? "Department Head" : "Trainer"}
                    </label>
                  ))}
                </div>

                {editRoles.includes("DH") && (
                  <div className="space-y-1">
                    <Label className="text-xs">DH Department</Label>
                    <Select value={editDHDept} onValueChange={setEditDHDept}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {(depts ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editRoles.includes("T") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Trainer departments (check all that apply, pick one primary)</Label>
                    <RadioGroup value={editPrimary} onValueChange={setEditPrimary} className="space-y-1">
                      {(depts ?? []).map((d) => {
                        const checked = editTrainerDepts.includes(d.id);
                        return (
                          <div key={d.id} className="flex items-center gap-3 rounded border px-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setEditTrainerDepts((prev) => {
                                  const next = v ? Array.from(new Set([...prev, d.id])) : prev.filter((x) => x !== d.id);
                                  if (!v && editPrimary === d.id) setEditPrimary(next[0] ?? "");
                                  if (v && !editPrimary) setEditPrimary(d.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="flex-1 text-sm">{d.name}</span>
                            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                              <RadioGroupItem value={d.id} disabled={!checked} /> Primary
                            </label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </div>
                )}

                <Button size="sm"
                  disabled={
                    editRoles.length === 0 ||
                    (editRoles.includes("DH") && !editDHDept) ||
                    (editRoles.includes("T") && (editTrainerDepts.length === 0 || !editPrimary)) ||
                    saveAccess.isPending
                  }
                  onClick={() => saveAccess.mutate()}>
                  {saveAccess.isPending ? "Saving…" : "Save roles & departments"}
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
