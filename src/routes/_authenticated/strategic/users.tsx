import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers, createUserAccount, toggleBypassGeofence, updateUserRoles, setTrainerDepartments, setDHDepartment, adminSetUserPhone, adminSetUserEmail, adminSetUserActive } from "@/lib/users-admin.functions";
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
import { isValidEtPhone } from "@/lib/phone";
import { EmailField, PhoneField, TextField, PasswordField, SelectField, isValidEmail } from "@/components/forms/fields";
import { FormBody, FormSection, FormGrid, FormFull, FormError } from "@/components/forms/layout";
import { useFormSubmit } from "@/hooks/use-form-submit";

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
  const phoneFn = useServerFn(adminSetUserPhone);
  const emailFn = useServerFn(adminSetUserEmail);
  const activeFn = useServerFn(adminSetUserActive);
  const { data: users, isLoading } = useQuery({ queryKey: ["all-users"], queryFn: () => listFn() });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => deptsFn() });
  const { data: cfg } = useQuery({ queryKey: ["global-config"], queryFn: () => cfgFn() });
  const geoEnabled = cfg?.geofence_enabled ?? true;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "T" as "MA" | "DH" | "T", department_id: "" });
  const [avatarPath, setAvatarPath] = useState("");

  const [manage, setManage] = useState<null | { id: string; name: string; email: string; avatar_url: string | null; roles: string[]; department_ids: string[]; primary_department_id: string | null; department_id: string | null; phone: string | null; active: boolean }>(null);
  const [newAvatarPath, setNewAvatarPath] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoles, setEditRoles] = useState<("MA" | "DH" | "T")[]>([]);
  const [editTrainerDepts, setEditTrainerDepts] = useState<string[]>([]);
  const [editPrimary, setEditPrimary] = useState<string>("");
  const [editDHDept, setEditDHDept] = useState<string>("");

  const create = useFormSubmit({
    mutationFn: () => createFn({ data: { ...form, department_id: form.department_id || null, avatar_path: avatarPath } }),
    invalidateKeys: [["all-users"], ["contacts"], ["dh"], ["trainers"]],
    successMessage: "User account created",
    onSaved: () => {
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", password: "", role: "T", department_id: "" });
      setAvatarPath("");
    },
  });

  const canCreate =
    !!form.full_name.trim() && !!form.email && isValidEmail(form.email) &&
    !!form.phone && isValidEtPhone(form.phone) && form.password.length >= 8 &&
    (form.role === "MA" || !!form.department_id) && !!avatarPath;

  const toggle = useMutation({
    mutationFn: (vars: { user_id: string; bypass: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-users"] }),
    onError: (e: Error) => toastError(e),
  });

  const saveAvatar = useMutation({
    mutationFn: (vars: { user_id: string; avatar_path: string }) => setAvatarFn({ data: vars }),
    onSuccess: () => { toast.success("Photo updated"); setNewAvatarPath(""); qc.invalidateQueries({ queryKey: ["all-users"] }); },
    onError: (e: Error) => toastError(e),
  });
  const savePassword = useMutation({
    mutationFn: (vars: { user_id: string; new_password: string }) => setPasswordFn({ data: vars }),
    onSuccess: (r: any) => {
      toast.success(r?.sessions_revoked === false
        ? "Password updated. Ask the user to sign in again."
        : "Password updated. The user has been signed out of all devices.");
      setNewPassword("");
    },
    onError: (e: Error) => toastError(e),
  });

  const savePhone = useMutation({
    mutationFn: (vars: { user_id: string; phone: string }) => phoneFn({ data: vars }),
    onSuccess: () => {
      toast.success("Telephone updated");
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dh"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const saveEmail = useMutation({
    mutationFn: (vars: { user_id: string; email: string }) => emailFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success("Email address updated");
      setManage((m) => (m ? { ...m, email: vars.email } : m));
      qc.invalidateQueries({ queryKey: ["all-users"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["dh"] });
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const setActive = useMutation({
    mutationFn: (vars: { user_id: string; active: boolean }) => activeFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.active ? "Account activated" : "Account suspended");
      setManage((m) => (m ? { ...m, active: vars.active } : m));
      qc.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (e: Error) => toastError(e),
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
    onError: (e: Error) => toastError(e),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users &amp; Roles</h1>
          <p className="text-sm text-muted-foreground">Provision accounts and manage the geofence bypass flag.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!create.isSaving) setOpen(o); }}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Create user</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Register user account</DialogTitle></DialogHeader>
            <FormBody>
              <FormError message={create.error} />
              <FormSection title="Identity">
                <AvatarUploader ownerId="pending" required onUploaded={(p) => setAvatarPath(p)} />
                <FormGrid>
                  <FormFull>
                    <TextField label="Full name" required value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="e.g. Abdi Mohammed Ali" />
                  </FormFull>
                </FormGrid>
              </FormSection>
              <FormSection title="Contact details" description="Email and telephone are stored separately.">
                <FormGrid>
                  <EmailField label="Email address" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                  <PhoneField label="Telephone number" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} hint="Ethiopian number, e.g. 0912345678" />
                </FormGrid>
              </FormSection>
              <FormSection title="Access">
                <FormGrid>
                  <PasswordField label="Password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} reveal={false} />
                  <SelectField
                    label="Role"
                    required
                    value={form.role}
                    onChange={(v) => setForm({ ...form, role: v as any })}
                    options={[
                      { value: "MA", label: "Master Admin" },
                      { value: "DH", label: "Department Head" },
                      { value: "T", label: "Trainer" },
                    ]}
                  />
                  <FormFull>
                    <SelectField
                      label="Department"
                      required={form.role !== "MA"}
                      value={form.department_id}
                      onChange={(v) => setForm({ ...form, department_id: v })}
                      placeholder={form.role === "MA" ? "(optional)" : "Select department"}
                      options={(depts ?? []).map((d) => ({ value: d.id, label: d.name }))}
                    />
                  </FormFull>
                </FormGrid>
              </FormSection>
            </FormBody>
            <DialogFooter>
              <Button variant="outline" disabled={create.isSaving} onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.submit()} disabled={!canCreate || create.isSaving}>
                {create.isSaving ? "Creating…" : "Register account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">All users</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead></TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Telephone</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead>Bypass geofence</TableHead><TableHead className="w-20 text-right">Manage</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && !users?.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>}
              {(users ?? []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      {u.avatar_url ? <AvatarImage src={u.avatar_url} alt="" /> : <AvatarFallback className="text-xs">{(u.full_name || u.email || "U").slice(0,2).toUpperCase()}</AvatarFallback>}
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.phone || "—"}</TableCell>
                  <TableCell>
                    {u.roles.length === 0 && <Badge variant="secondary">No role</Badge>}
                    {u.roles.map((r: string) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>)}
                  </TableCell>
                  <TableCell className="text-sm">{u.department_name}</TableCell>
                  <TableCell>
                    <Badge variant={u.active === false ? "destructive" : "default"}>{u.active === false ? "Suspended" : "Active"}</Badge>
                  </TableCell>
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
                        phone: u.phone ?? null,
                        active: u.active !== false,
                      });
                      setNewAvatarPath(""); setNewPassword(""); setEditPhone(u.phone ?? ""); setEditEmail(u.email ?? "");
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 pb-3"><DialogTitle>Manage user — {manage?.name}</DialogTitle></DialogHeader>
          {manage && (
            <FormBody className="max-h-[70vh] flex-1 space-y-6 pr-2">
              <FormSection title="Profile photo">
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
              </FormSection>

              <FormSection title="Contact details" description="Email address and telephone number are stored and saved separately.">
                <FormGrid>
                  <div className="space-y-2">
                    <EmailField label="Email address" required value={editEmail} onChange={setEditEmail} />
                    <Button size="sm" variant="outline"
                      disabled={!editEmail || !isValidEmail(editEmail) || editEmail.trim().toLowerCase() === (manage.email ?? "").toLowerCase() || saveEmail.isPending}
                      onClick={() => saveEmail.mutate({ user_id: manage.id, email: editEmail.trim() })}>
                      {saveEmail.isPending ? "Saving…" : "Save email"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <PhoneField label="Telephone number" required value={editPhone} onChange={setEditPhone} hint="Ethiopian number, e.g. 0912345678" />
                    <Button size="sm" variant="outline"
                      disabled={!editPhone || !isValidEtPhone(editPhone) || savePhone.isPending}
                      onClick={() => savePhone.mutate({ user_id: manage.id, phone: editPhone })}>
                      {savePhone.isPending ? "Saving…" : "Save telephone"}
                    </Button>
                  </div>
                </FormGrid>
              </FormSection>

              <FormSection title="Security" description="Resetting the password signs the user out of all devices.">
                <div className="space-y-2 sm:max-w-sm">
                  <Label className="text-xs font-medium">New password (min 8 characters)</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a new password" />
                  <Button size="sm" variant="outline" disabled={newPassword.length < 8 || savePassword.isPending}
                    onClick={() => savePassword.mutate({ user_id: manage.id, new_password: newPassword })}>
                    {savePassword.isPending ? "Updating…" : "Reset password"}
                  </Button>
                </div>
              </FormSection>

              <FormSection title="Account status">
                <div className="flex items-center gap-3">
                  <Badge variant={manage.active ? "default" : "destructive"}>{manage.active ? "Active" : "Suspended"}</Badge>
                  <Button size="sm" variant={manage.active ? "destructive" : "default"} disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ user_id: manage.id, active: !manage.active })}>
                    {setActive.isPending ? "Saving…" : manage.active ? "Suspend account" : "Activate account"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Suspended users are blocked from signing in until reactivated.</p>
              </FormSection>

              <FormSection title="Roles & departments">
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
              </FormSection>
            </FormBody>
          )}
          <DialogFooter className="shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setManage(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
