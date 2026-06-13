import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import {
  getWipePreview,
  wipeEntireSystem,
  resetAcademicData,
} from "@/lib/system-admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert, Trash2, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/system-data")({
  component: SystemDataPage,
});

type Mode = "wipe" | "reset" | null;

function SystemDataPage() {
  const { data: me } = useMe();
  const previewFn = useServerFn(getWipePreview);
  const wipeFn = useServerFn(wipeEntireSystem);
  const resetFn = useServerFn(resetAcademicData);

  const { data: preview, refetch, isLoading } = useQuery({
    queryKey: ["wipe-preview"],
    queryFn: () => previewFn(),
  });

  const [mode, setMode] = useState<Mode>(null);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const requiredPhrase = mode === "wipe" ? "WIPE ENTIRE SYSTEM" : "RESET ACADEMIC DATA";
  const tablesForMode = mode === "wipe" ? preview?.full_tables : preview?.academic_tables;
  const totalForMode = mode === "wipe" ? preview?.full_total : preview?.academic_total;

  const wipeMut = useMutation({
    mutationFn: () => wipeFn({ data: { confirm_phrase: phrase } }),
    onSuccess: () => {
      toast.success("System wiped. Signing out…");
      setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }, 1500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { confirm_phrase: phrase } }),
    onSuccess: () => {
      toast.success("Academic data reset complete.");
      closeDialog();
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = wipeMut.isPending || resetMut.isPending || verifying;

  function closeDialog() {
    setMode(null);
    setPhrase("");
    setPassword("");
  }

  async function handleConfirm() {
    if (phrase !== requiredPhrase) {
      toast.error("Confirmation phrase does not match.");
      return;
    }
    if (mode === "wipe") {
      // Password reverification for the destructive operation.
      const email = me?.profile?.email;
      if (!email) {
        toast.error("Cannot verify current user.");
        return;
      }
      setVerifying(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setVerifying(false);
      if (error) {
        toast.error("Password reverification failed.");
        return;
      }
      wipeMut.mutate();
    } else if (mode === "reset") {
      resetMut.mutate();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Data Management</h1>
        <p className="text-sm text-muted-foreground">
          Master Admin only. Destructive operations are irreversible and fully audited.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Complete System Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Wipes every department, user (except you), trainer, student, schedule,
              module, approval, attendance, audit and academic record. Returns the
              installation to a clean state.
            </p>
            <div className="rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-medium text-destructive">
                {isLoading ? "Counting…" : `${preview?.full_total ?? 0} records will be deleted`}
              </p>
              <p className="text-xs text-muted-foreground">Across {preview?.full_tables.length ?? 0} tables.</p>
            </div>
            <Button variant="destructive" className="w-full" onClick={() => setMode("wipe")}>
              <Trash2 className="mr-2 h-4 w-4" /> Wipe Entire System
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Academic Data Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Keeps users, roles, departments, levels, sections, venues, department
              heads and settings. Removes students, schedules, modules, attendance,
              approvals and academic operational records.
            </p>
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm">
              <p className="font-medium text-amber-700">
                {isLoading ? "Counting…" : `${preview?.academic_total ?? 0} records will be deleted`}
              </p>
              <p className="text-xs text-muted-foreground">Across {preview?.academic_tables.length ?? 0} tables.</p>
            </div>
            <Button variant="outline" className="w-full border-amber-500/60 text-amber-700 hover:bg-amber-50"
              onClick={() => setMode("reset")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Academic Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Live record counts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
            {(preview?.full_tables ?? []).map((t) => (
              <div key={t} className="flex items-center justify-between rounded-md border p-2">
                <span className="truncate text-muted-foreground">{t}</span>
                <Badge variant="secondary">{preview?.counts[t] ?? 0}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && !isPending && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              {mode === "wipe" ? "Confirm: Wipe Entire System" : "Confirm: Reset Academic Data"}
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. {totalForMode ?? 0} records across{" "}
              {tablesForMode?.length ?? 0} tables will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Type exactly: <span className="font-mono font-semibold">{requiredPhrase}</span></Label>
              <Input value={phrase} onChange={(e) => setPhrase(e.target.value)}
                placeholder={requiredPhrase} disabled={isPending} />
            </div>
            {mode === "wipe" && (
              <div>
                <Label className="text-xs">Re-enter your password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Master Admin password" disabled={isPending} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={
                isPending ||
                phrase !== requiredPhrase ||
                (mode === "wipe" && password.length < 6)
              }
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Working…" : mode === "wipe" ? "Wipe Entire System" : "Reset Academic Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}