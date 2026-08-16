import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CsvDropzone } from "@/components/csv-dropzone";
import { useAuthSession } from "@/hooks/use-auth-session";
import { isValidEtPhone, PHONE_ERROR } from "@/lib/phone";
import {
  CONTACT_GROUPS, listContacts, upsertExternalContact, deleteExternalContact,
  importExternalContacts, type Contact, type ContactGroup,
} from "@/lib/contacts.functions";
import {
  cancelScheduledCampaign, getSmsSettings, getSmsStatus, listSmsCampaigns, listSmsRecipients,
  rescheduleCampaign, scheduleSmsCampaign, sendSmsCampaign, sendTestSms, updateSmsSettings,
} from "@/lib/sms.functions";
import { BookUser, Clock, MessageSquarePlus, Pencil, Plus, Send, Settings2, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/contacts")({
  component: ContactBookPage,
  head: () => ({
    meta: [
      { title: "Contact Book & SMS | TVET ERP" },
      { name: "description", content: "Admin contact book with grouped staff, student and guardian contacts, and bulk SMS." },
    ],
  }),
});

const groupLabel = (g: ContactGroup) => CONTACT_GROUPS.find((x) => x.id === g)?.label ?? g;

function ContactBookPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const fetchContacts = useServerFn(listContacts);
  const fetchStatus = useServerFn(getSmsStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => fetchContacts(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });
  const { data: smsStatus } = useQuery({
    queryKey: ["sms-status"],
    queryFn: () => fetchStatus(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });

  const contacts = data?.contacts ?? [];
  const departments = data?.departments ?? [];
  const classes = data?.classes ?? [];

  const [tab, setTab] = useState("book");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("ALL");
  const [dept, setDept] = useState<string>("ALL");
  const [cls, setCls] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [detail, setDetail] = useState<Contact | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (group !== "ALL" && c.group !== group) return false;
      if (dept !== "ALL" && c.department_id !== dept) return false;
      if (cls !== "ALL" && c.class_name !== cls) return false;
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q);
    });
  }, [contacts, search, group, dept, cls, status]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts) m[c.group] = (m[c.group] ?? 0) + 1;
    return m;
  }, [contacts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookUser className="h-6 w-6 text-primary" /> Contact Book
          </h1>
          <p className="text-sm text-muted-foreground">
            Contacts are sourced live from staff, trainer, student and guardian registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {smsStatus?.environment === "development" && <Badge variant="outline">Dev mode</Badge>}
          <Badge variant={smsStatus?.configured ? "secondary" : "destructive"}>
            SMS gateway: {smsStatus?.configured ? "Ready" : "Not configured"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CONTACT_GROUPS.map((g) => (
          <Card key={g.id} className="p-4">
            <p className="text-xs text-muted-foreground">{g.label}</p>
            <p className="mt-1 text-2xl font-semibold">{counts[g.id] ?? 0}</p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="book">Contacts</TabsTrigger>
          <TabsTrigger value="other">Other Staff</TabsTrigger>
          <TabsTrigger value="compose">Create SMS</TabsTrigger>
          <TabsTrigger value="history">SMS History</TabsTrigger>
          <TabsTrigger value="settings">Gateway Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="mt-4 space-y-4">
          <Card className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="Search name or telephone…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger><SelectValue placeholder="Group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All groups</SelectItem>
                  {CONTACT_GROUPS.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cls} onValueChange={setCls}>
                <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All classes</SelectItem>
                  {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{filtered.length} contact(s)</span>
              <span>{Object.values(selected).filter(Boolean).length} selected for SMS</span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Telephone</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={7}>Loading…</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground">No contacts match these filters.</TableCell></TableRow>
                  )}
                  {filtered.slice(0, 500).map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setDetail(c)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={!!selected[c.id]}
                          disabled={!c.phone}
                          onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{groupLabel(c.group)}</TableCell>
                      <TableCell>{c.department_name}</TableCell>
                      <TableCell>{c.class_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "ACTIVE" ? "secondary" : "outline"}>{c.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="p-2 text-xs text-muted-foreground">Showing the first 500 rows — refine your filters to narrow the list.</p>
              )}
            </div>
            <Button onClick={() => setTab("compose")} disabled={Object.values(selected).filter(Boolean).length === 0}>
              <MessageSquarePlus className="mr-2 h-4 w-4" /> Create SMS to selected
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="mt-4">
          <OtherStaffTab departments={departments} contacts={contacts} onChanged={() => qc.invalidateQueries({ queryKey: ["contacts"] })} />
        </TabsContent>

        <TabsContent value="compose" className="mt-4">
          <ComposeTab
            contacts={contacts}
            departments={departments}
            classes={classes}
            selectedIds={Object.keys(selected).filter((k) => selected[k])}
            configured={!!smsStatus?.configured}
            onSent={() => { setSelected({}); setTab("history"); qc.invalidateQueries({ queryKey: ["sms-campaigns"] }); }}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <GatewaySettingsTab onSaved={() => qc.invalidateQueries({ queryKey: ["sms-status"] })} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>{detail ? groupLabel(detail.group) : ""}</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            <Row label="Telephone" value={detail?.phone ?? "—"} />
            <Row label="Department" value={detail?.department_name ?? "—"} />
            <Row label="Class" value={detail?.class_name ?? "—"} />
            <Row label="Details" value={detail?.detail ?? "—"} />
            <Row label="Status" value={detail?.status ?? "—"} />
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/* ---------------- Other staff ---------------- */

function OtherStaffTab({
  departments, contacts, onChanged,
}: {
  departments: { id: string; name: string }[];
  contacts: Contact[];
  onChanged: () => void;
}) {
  const upsert = useServerFn(upsertExternalContact);
  const del = useServerFn(deleteExternalContact);
  const importFn = useServerFn(importExternalContacts);

  const rows = contacts.filter((c) => c.group === "OTHER_STAFF");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [deptId, setDeptId] = useState<string>("NONE");
  const [active, setActive] = useState(true);
  const phoneErr = phone !== "" && !isValidEtPhone(phone) ? PHONE_ERROR : null;

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          ...(editId ? { id: editId } : {}),
          full_name: name,
          phone,
          role_title: role || null,
          department_id: deptId === "NONE" ? null : deptId,
          active,
        },
      }),
    onSuccess: () => { toast.success("Contact saved"); setOpen(false); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Contact deleted"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const importMut = useMutation({
    mutationFn: (r: { full_name: string; phone: string; role_title?: string; department?: string }[]) =>
      importFn({ data: { rows: r } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.inserted} contact(s)${res.errors.length ? `, ${res.errors.length} skipped` : ""}`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditId(null); setName(""); setPhone(""); setRole(""); setDeptId("NONE"); setActive(true); setOpen(true);
  }
  function openEdit(c: Contact) {
    setEditId(c.source_id); setName(c.name); setPhone(c.phone ?? ""); setRole(c.detail ?? "");
    setDeptId(c.department_id ?? "NONE"); setActive(c.status === "ACTIVE"); setOpen(true);
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Other / Imported Staff</h2>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add contact</Button>
      </div>

      <CsvDropzone
        helpText="Columns: full_name, phone, role_title, department"
        sampleHeaders={["full_name", "phone", "role_title", "department"]}
        onParsed={(parsed) =>
          importMut.mutate(
            parsed.map((r) => ({
              full_name: r["full_name"] ?? r["Full Name"] ?? "",
              phone: r["phone"] ?? r["Phone"] ?? r["telephone"] ?? "",
              role_title: r["role_title"] ?? r["Role"] ?? "",
              department: r["department"] ?? r["Department"] ?? "",
            })),
          )
        }
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead><TableHead>Telephone</TableHead><TableHead>Role</TableHead>
            <TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground">No external staff contacts yet.</TableCell></TableRow>}
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.phone ?? "—"}</TableCell>
              <TableCell>{c.detail ?? "—"}</TableCell>
              <TableCell>{c.department_name}</TableCell>
              <TableCell><Badge variant={c.status === "ACTIVE" ? "secondary" : "outline"}>{c.status}</Badge></TableCell>
              <TableCell className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => delMut.mutate(c.source_id)}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit contact" : "Add contact"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div>
              <Label>Telephone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" />
              {phoneErr && <p className="mt-1 text-xs text-destructive">{phoneErr}</p>}
            </div>
            <div><Label>Role / title</Label><Input value={role} onChange={(e) => setRole(e.target.value)} /></div>
            <div>
              <Label>Department</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} /> Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!name || !!phoneErr || !phone || saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- Compose ---------------- */

function ComposeTab({
  contacts, departments, classes, selectedIds, configured, onSent,
}: {
  contacts: Contact[];
  departments: { id: string; name: string }[];
  classes: string[];
  selectedIds: string[];
  configured: boolean;
  onSent: () => void;
}) {
  const send = useServerFn(sendSmsCampaign);
  const schedule = useServerFn(scheduleSmsCampaign);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [dept, setDept] = useState("ALL");
  const [cls, setCls] = useState("ALL");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState("");

  const recipients = useMemo(() => {
    const map = new Map<string, Contact>();
    const inFilter = (c: Contact) =>
      (dept === "ALL" || c.department_id === dept) && (cls === "ALL" || c.class_name === cls);
    for (const c of contacts) {
      if (!c.phone) continue;
      const picked = selectedIds.includes(c.id) || (groups.includes(c.group) && inFilter(c));
      if (picked) map.set(c.phone, c);
    }
    return Array.from(map.values());
  }, [contacts, groups, dept, cls, selectedIds]);

  const preview = recipients[0]
    ? message.replace(/\{Name\}/g, recipients[0].name)
    : message.replace(/\{Name\}/g, "Abebe");
  const segments = Math.max(1, Math.ceil(message.length / 160));

  const sendMut = useMutation({
    mutationFn: () =>
      send({
        data: {
          message,
          groups: groups.length ? groups : ["SELECTION"],
          recipients: recipients.map((r) => ({ name: r.name, phone: r.phone!, group: r.group })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} of ${res.total} message(s)${res.failed ? `, ${res.failed} failed` : ""}`);
      setConfirm(false);
      setMessage("");
      onSent();
    },
    onError: (e: Error) => { setConfirm(false); toast.error(e.message); },
  });

  const scheduleMut = useMutation({
    mutationFn: () =>
      schedule({
        data: {
          message,
          groups: groups.length ? groups : ["SELECTION"],
          recipients: recipients.map((r) => ({ name: r.name, phone: r.phone!, group: r.group })),
          scheduled_at: new Date(when).toISOString(),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Scheduled ${res.total} message(s) for ${new Date(res.scheduled_at).toLocaleString()}`);
      setConfirm(false);
      setMessage("");
      setWhen("");
      onSent();
    },
    onError: (e: Error) => { setConfirm(false); toast.error(e.message); },
  });

  const busy = sendMut.isPending || scheduleMut.isPending;
  const whenValid = mode === "now" || (when !== "" && !Number.isNaN(new Date(when).getTime()));

  return (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Create SMS</h2>

      <div>
        <Label className="mb-2 block">Recipient groups</Label>
        <div className="flex flex-wrap gap-3">
          {CONTACT_GROUPS.map((g) => (
            <label key={g.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <Checkbox
                checked={groups.includes(g.id)}
                onCheckedChange={(v) =>
                  setGroups((s) => (v ? [...s, g.id] : s.filter((x) => x !== g.id)))
                }
              />
              {g.label}
            </label>
          ))}
        </div>
        {selectedIds.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Plus {selectedIds.length} individually selected contact(s) from the Contacts tab.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Department filter</Label>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Class filter</Label>
          <Select value={cls} onValueChange={setCls}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classes</SelectItem>
              {classes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Message</Label>
        <Textarea
          rows={5}
          value={message}
          maxLength={1000}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Dear {Name}, …"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {message.length} characters · {segments} SMS segment(s) · use <code>{"{Name}"}</code> to personalize
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <p className="mt-1 whitespace-pre-wrap">{preview || "—"}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Delivery</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as "now" | "later")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="now">Send now</SelectItem>
              <SelectItem value="later">Schedule for later</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "later" && (
          <div>
            <Label>Date &amp; time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Your local time. The batch is sent automatically.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{recipients.length} unique recipient(s)</p>
        <Button
          disabled={!configured || recipients.length === 0 || message.trim().length === 0 || !whenValid}
          onClick={() => setConfirm(true)}
        >
          {mode === "now" ? <Send className="mr-2 h-4 w-4" /> : <Clock className="mr-2 h-4 w-4" />}
          {mode === "now" ? "Send SMS" : "Schedule SMS"}
        </Button>
      </div>
      {!configured && <p className="text-xs text-destructive">The SMS gateway is not configured yet, so sending is disabled.</p>}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "now"
                ? `Send to ${recipients.length} recipient(s)?`
                : `Schedule for ${recipients.length} recipient(s)?`}
            </DialogTitle>
            <DialogDescription>
              Duplicate telephone numbers have already been removed.
              {mode === "later" && when ? ` Sending on ${new Date(when).toLocaleString()}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">{preview}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => (mode === "now" ? sendMut.mutate() : scheduleMut.mutate())}>
              {busy ? "Working…" : mode === "now" ? "Confirm & send" : "Confirm & schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------------- History ---------------- */

function HistoryTab() {
  const { authReady, hasSession } = useAuthSession();
  const fetchCampaigns = useServerFn(listSmsCampaigns);
  const fetchRecipients = useServerFn(listSmsRecipients);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: campaigns } = useQuery({
    queryKey: ["sms-campaigns"],
    queryFn: () => fetchCampaigns(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });
  const { data: recipients } = useQuery({
    queryKey: ["sms-recipients", openId],
    queryFn: () => fetchRecipients({ data: { campaign_id: openId! } }),
    enabled: !!openId,
    throwOnError: false,
  });

  return (
    <Card className="p-4">
      <h2 className="mb-3 font-semibold">SMS History</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead><TableHead>Sender</TableHead><TableHead>Message</TableHead>
            <TableHead>Groups</TableHead><TableHead>Total</TableHead><TableHead>Sent</TableHead>
            <TableHead>Failed</TableHead><TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(campaigns ?? []).length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-muted-foreground">No messages sent yet.</TableCell></TableRow>
          )}
          {(campaigns ?? []).map((c: any) => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
              <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
              <TableCell>{c.sender_name ?? "—"}</TableCell>
              <TableCell className="max-w-[240px] truncate">{c.message}</TableCell>
              <TableCell>{(c.groups ?? []).join(", ") || "—"}</TableCell>
              <TableCell>{c.total_recipients}</TableCell>
              <TableCell>{c.sent_count}</TableCell>
              <TableCell>{c.failed_count}</TableCell>
              <TableCell><Badge variant={c.status === "COMPLETED" ? "secondary" : "outline"}>{c.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Delivery detail</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Telephone</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(recipients ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.contact_name ?? "—"}</TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">{r.error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
