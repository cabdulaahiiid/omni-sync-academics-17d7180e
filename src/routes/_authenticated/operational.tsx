import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_FULL_NAME, COLLEGE_LOGO_URL } from "@/components/erp/brand";
import { Breadcrumbs } from "@/components/erp/breadcrumbs";
import {
  LayoutDashboard, CalendarRange,
  Activity, FileBarChart, LogOut, Menu, ShieldCheck, Upload, ClipboardCheck, GraduationCap, FileClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/operational")({
  component: OperationalShell,
});

const NAV = [
  { to: "/operational", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/operational/matrix", label: "Schedules", icon: CalendarRange },
  { to: "/operational/semester-upload", label: "Semester Upload", icon: Upload },
  { to: "/operational/drafts", label: "Drafts", icon: FileClock },
  { to: "/operational/students", label: "Students Hub", icon: GraduationCap },
  { to: "/operational/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/operational/live-monitor", label: "Live Monitoring", icon: Activity },
  { to: "/operational/reports", label: "Reports", icon: FileBarChart },
];

function OperationalShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!me?.roles.includes("DH") && !me?.roles.includes("MA")) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Department Head access only.</div>;
  }
  const initials = (me?.profile?.full_name || me?.profile?.email || "DH").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <img src={COLLEGE_LOGO_URL} alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold tracking-wide text-white">{COLLEGE_SHORT_NAME}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/60">Department Head</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to as string} onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-white/10 text-white shadow-sm" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}>
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/profile" onClick={() => setOpen(false)}
            className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <ShieldCheck className="h-4 w-4" /> My profile
          </Link>
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <img src={COLLEGE_LOGO_URL} alt="" className="h-7 w-7 rounded object-contain" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_FULL_NAME}</p>
              <Breadcrumbs />
            </div>
          </div>
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
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-[140px] truncate text-[13px] font-semibold text-foreground">
                {me?.profile?.full_name || me?.profile?.email || "User"}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {me?.roles?.includes("MA") ? "Master Admin" : me?.roles?.includes("DH") ? "Department Head" : "User"}
              </span>
            </div>
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-3 lg:p-4"><Outlet /></div>
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
}