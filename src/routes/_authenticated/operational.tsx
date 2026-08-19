import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { pickHome } from "@/lib/auth/roles";
import { AppShell } from "@/components/erp/app-shell";
import { OPERATIONAL_NAV, operationalNavFor } from "@/components/erp/operational-nav";

export const Route = createFileRoute("/_authenticated/operational")({
  component: OperationalShell,
});

function OperationalShell() {
  const { data: me, isLoading, rolesReady } = useMe();
  const navigate = useNavigate();
  const allowed = !!me && (me.roles.includes("DH") || me.roles.includes("MA"));
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
  const nav = operationalNavFor(me) ?? OPERATIONAL_NAV;
  return (
    <AppShell nav={nav}>
      <Outlet />
    </AppShell>
  );
}
