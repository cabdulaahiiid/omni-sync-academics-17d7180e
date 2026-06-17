import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { pickHome } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_LOGO_URL } from "@/components/erp/brand";

export const Route = createFileRoute("/_authenticated/ground")({
  component: GroundShell,
});

function GroundShell() {
  const { data: me, isLoading, rolesReady } = useMe();
  const navigate = useNavigate();
  const allowed = !!me && (me.roles.includes("T") || me.roles.includes("DH") || me.roles.includes("MA"));
  useEffect(() => {
    if (!rolesReady || !me) return;
    if (!allowed) {
      const home = pickHome(me.roles);
      void navigate({ to: home ?? "/login", replace: true });
    }
  }, [rolesReady, allowed, me, navigate]);
  if (isLoading || !rolesReady || !allowed) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  const initials = (me?.profile?.full_name || me?.profile?.email || "TR").slice(0, 2).toUpperCase();
  const roleLabel = me?.roles?.includes("MA") ? "Master Admin" : "Trainer";
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src={COLLEGE_LOGO_URL} alt="" className="h-8 w-8 rounded object-contain" />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{COLLEGE_SHORT_NAME}</p>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <Link
            to="/profile"
            className="ml-1 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5 hover:bg-muted/60"
            aria-label="My profile"
          >
            <Avatar className="h-7 w-7">
              {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="" />}
              <AvatarFallback className="bg-teal/15 text-teal text-[10px] font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-[110px] truncate text-[13px] font-semibold text-foreground">
                {me?.profile?.full_name || me?.profile?.email || "User"}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4"><Outlet /></main>
      <OfflineBanner />
    </div>
  );
}