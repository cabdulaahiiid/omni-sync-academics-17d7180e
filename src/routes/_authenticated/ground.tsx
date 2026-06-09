import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME } from "@/components/erp/brand";

export const Route = createFileRoute("/_authenticated/ground")({
  component: GroundShell,
});

function GroundShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!me?.roles.includes("T") && !me?.roles.includes("MA")) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Trainer access only.</div>;
  }
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_SHORT_NAME}</p>
          <p className="truncate text-sm font-medium">{me?.profile?.full_name || me?.profile?.email} · <span className="text-muted-foreground">Trainer</span></p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4"><Outlet /></main>
      <OfflineBanner />
    </div>
  );
}