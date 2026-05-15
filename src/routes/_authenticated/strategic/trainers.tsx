import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTrainers, createTrainer, revokeTrainer } from "@/lib/dh.functions";
import { listDepartments } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/trainers")({
  component: TrainersPage,
});

function TrainersPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const canQuery = authReady && hasSession;
  const list = useServerFn(listTrainers);
  const listD = useServerFn(listDepartments);
  const create = useServerFn(createTrainer);
  const revoke = useServerFn(revokeTrainer);
  const { data: rows, isLoading } = useQuery({ queryKey: ["trainers"], queryFn: () => list(), enabled: canQuery, throwOnError: false });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => listD(), enabled: canQuery, throwOnError: false });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [deptId, setDeptId] = useState("");
  const [password, setPassword] = useState("Trainer@123");
  const [quals, setQuals] = useState("");
  const [credentials, setCredentials] = useState<{ email: string; temp_password: string } | null>(null);

  const createMut = useMutation({
    mutationFn: () => create({ data: {
      email, full_name: fullName, department_id: deptId, password,
      phone: phone || null,
      qualifications: quals.split(",").map((q) => q.trim()).filter(Boolean),
    } }),
    onSuccess: (r) => {
      toast.success("Trainer account created");
      setCredentials({ email: r.email, temp_password: r.temp_password });
      setOpen(false);
      setEmail(""); setFullName(""); setPhone(""); setDeptId(""); setPassword("Trainer@123"); setQuals("");
      qc.invalidateQueries({ queryKey: ["trainers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Trainer suspended"); qc.invalidateQueries({ queryKey: ["trainers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trainers</h1>
          <p className="text-sm text-muted-foreground">Provision trainer accounts with email + password.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Create trainer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create trainer account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="trainerx@tvet.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="space-y-2"><Label>Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {(depts ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qualifications (comma-separated module codes)</Label>
                <Input placeholder="ICT-101, ICT-102" value={quals} onChange={(e) => setQuals(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={!email || !fullName || !deptId || !password || createMut.isPending}>
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
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead><TableHead>Qualifications</TableHead><TableHead>Status</TableHead><TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && !rows?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No trainers yet.</TableCell></TableRow>}
            {rows?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{t.email}</TableCell>
                <TableCell>{t.department_name}</TableCell>
                <TableCell className="text-xs">{(t.qualifications ?? []).join(", ") || "—"}</TableCell>
                <TableCell><Badge variant={t.status === "ACTIVE" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" disabled={t.status !== "ACTIVE"} onClick={() => { if (confirm(`Suspend ${t.full_name}?`)) revokeMut.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
