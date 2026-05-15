import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/operational")({
  component: OperationalShell,
});

function OperationalShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!me?.roles.includes("DH") && !me?.roles.includes("MA")) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Department Head access only.</div>;
  }
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex h-16 items-center justify-between border-b bg-background px-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Department Head</p>
          <p className="text-sm font-medium">{me?.profile?.full_name || me?.profile?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
      </header>
      <main className="p-8"><Outlet /></main>
    </div>
  );
}