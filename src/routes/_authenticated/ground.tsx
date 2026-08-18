import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-me";
import { pickHome } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { RoleSwitcher } from "@/components/role-switcher";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_LOGO_URL } from "@/components/erp/brand";
import { Home as HomeIcon, CalendarDays, Users as UsersIcon, BarChart3, User as UserIcon } from "lucide-react";

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
  const baseRoleLabel = me?.roles?.includes("MA") ? "Master Admin" : "Trainer";
  const roleLabel = me?.roles?.includes("MA")
    ? baseRoleLabel
    : me?.departmentName
      ? `${me.departmentName} · Trainer`
      : baseRoleLabel;
  const firstName = (me?.profile?.full_name || "Trainer").split(" ")[0];
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  return (
    <div className="trainer-theme min-h-screen bg-[#F1F5F9] pb-20">
      <header className="sticky top-0 z-30 bg-[#123E7C] px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <Link to="/ground/profile" className="flex min-w-0 items-center gap-3" aria-label="My profile">
            <Avatar className="h-10 w-10 ring-2 ring-white/40">
              {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="" />}
              <AvatarFallback className="bg-white/15 text-[11px] font-semibold text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] text-white/70">{greeting},</p>
              <p className="truncate text-[15px] font-semibold">{me?.profile?.full_name || firstName}</p>
              <p className="text-[10px] text-white/70">{roleLabel}</p>
            </div>
          </Link>
          <div className="flex items-center gap-1 text-white [&_button]:text-white [&_svg]:text-white">
            <RoleSwitcher className="hidden sm:flex" />
            <NotificationsBell />
            <img src={COLLEGE_LOGO_URL} alt="" className="hidden h-9 w-9 rounded-lg bg-white object-contain p-0.5 sm:block" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4"><Outlet /></main>
      <OfflineBanner />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          <TabLink to="/ground" icon={<HomeIcon className="h-5 w-5" />} label="Home" />
          <TabLink to="/ground/sessions" icon={<CalendarDays className="h-5 w-5" />} label="Sessions" />
          <TabLink to="/ground/students" icon={<UsersIcon className="h-5 w-5" />} label="Students" />
          <TabLink to="/ground/reports" icon={<BarChart3 className="h-5 w-5" />} label="Reports" />
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