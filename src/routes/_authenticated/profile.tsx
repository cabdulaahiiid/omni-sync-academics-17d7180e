import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMe } from "@/hooks/use-me";
import { updateMyAvatar, changeMyPassword } from "@/lib/profile.functions";
import { AvatarUploader } from "@/components/avatar-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const updateAvatarFn = useServerFn(updateMyAvatar);
  const changePwFn = useServerFn(changeMyPassword);

  const [pendingPath, setPendingPath] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const saveAvatar = useMutation({
    mutationFn: () => updateAvatarFn({ data: { avatar_path: pendingPath } }),
    onSuccess: () => { toast.success("Photo updated"); setPendingPath(""); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: Error) => toastError(e),
  });
  const savePassword = useMutation({
    mutationFn: () => changePwFn({ data: { current_password: currentPw, new_password: newPw } }),
    onSuccess: () => { toast.success("Password changed"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); },
    onError: (e: Error) => toastError(e),
  });

  if (isLoading || !me) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="text-sm text-muted-foreground">{me.profile?.full_name} · {me.profile?.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile photo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <AvatarUploader
            ownerId={me.userId}
            initialUrl={me.avatar_url}
            fallback={me.profile?.full_name || me.profile?.email || "U"}
            label="Your photo"
            onUploaded={(p) => setPendingPath(p)}
          />
          <Button size="sm" disabled={!pendingPath || saveAvatar.isPending} onClick={() => saveAvatar.mutate()}>
            {saveAvatar.isPending ? "Saving…" : "Save photo"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2"><Label>Current password</Label><Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} /></div>
          <div className="space-y-2"><Label>New password (min 8 chars)</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
          <div className="space-y-2"><Label>Confirm new password</Label><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></div>
          <Button
            size="sm"
            disabled={!currentPw || newPw.length < 8 || newPw !== confirmPw || savePassword.isPending}
            onClick={() => savePassword.mutate()}
          >
            {savePassword.isPending ? "Updating…" : "Change password"}
          </Button>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}