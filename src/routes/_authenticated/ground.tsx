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
import { Home as HomeIcon, ClipboardCheck, User as UserIcon } from "lucide-react";

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
  const firstName = (me?.profile?.full_name || "Trainer").split(" ")[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  return (
    <div className="trainer-theme min-h-screen bg-[#F8FAFC] pb-20">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={COLLEGE_LOGO_URL} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain ring-1 ring-slate-200" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">{greeting}</p>
              <p className="truncate text-[15px] font-semibold text-[#123E7C]">{firstName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Link
              to="/ground/profile"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 hover:bg-slate-50"
              aria-label="My profile"
            >
              <Avatar className="h-8 w-8">
                {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="" />}
                <AvatarFallback className="bg-[#123E7C]/10 text-[#123E7C] text-[11px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="max-w-[120px] truncate text-[13px] font-semibold text-slate-800">
                  {me?.profile?.full_name || me?.profile?.email || "User"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{roleLabel}</span>
              </div>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4"><Outlet /></main>
      <OfflineBanner />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          <TabLink to="/ground" icon={<HomeIcon className="h-5 w-5" />} label="Home" />
          <TabLink to="/ground/completed" icon={<ClipboardCheck className="h-5 w-5" />} label="Completed" />
          <TabLink to="/ground/profile" icon={<UserIcon className="h-5 w-5" />} label="Profile" />
        </div>
      </nav>
      <div aria-hidden className="hidden">
        <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>Sign out</Button>
      </div>
    </div>
  );
}

function TabLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/ground" }}
      className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-500 data-[status=active]:text-[#123E7C]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}