import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_FULL_NAME } from "@/components/erp/brand";
import { Breadcrumbs } from "@/components/erp/breadcrumbs";
import { Input } from "@/components/ui/input";
import { pushRecentPage } from "@/lib/ui/recent-pages-store";
import {
  LayoutDashboard, CalendarRange,
  Activity, FileBarChart, LogOut, Menu, ShieldCheck, Upload, ClipboardCheck, GraduationCap, FileClock,
  Search, ChevronRight,
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
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" && localStorage.getItem("tvet:dh-sidebar:collapsed") === "1",
  );
  useEffect(() => {
    try { localStorage.setItem("tvet:dh-sidebar:collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);
  useEffect(() => {
    const found = NAV.find((i) => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to));
    if (found) pushRecentPage({ to: found.to, label: found.label });
  }, [location.pathname]);
  const q = query.trim().toLowerCase();
  const filteredNav = q ? NAV.filter((i) => i.label.toLowerCase().includes(q)) : NAV;

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!me?.roles.includes("DH") && !me?.roles.includes("MA")) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Department Head access only.</div>;
  }
  const initials = (me?.profile?.full_name || me?.profile?.email || "DH").slice(0, 2).toUpperCase();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col nav-surface text-sidebar-foreground transition-all duration-200 lg:static lg:translate-x-0",
        collapsed ? "w-[68px]" : "w-64",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className={cn(
          "flex h-16 items-center gap-3 border-b border-white/10",
          collapsed ? "px-3 justify-center" : "px-5",
        )}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold tracking-wide text-white">{COLLEGE_SHORT_NAME}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/60">Department Head</span>
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="ml-auto hidden h-7 w-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white lg:flex"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/5">
            <Avatar className="h-9 w-9 ring-2 ring-white/10">
              <AvatarFallback className="bg-white/10 text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{me?.profile?.full_name || "Department Head"}</p>
              <p className="truncate text-[11px] text-white/60">Department Head</p>
            </div>
          </div>
        )}
        {!collapsed && (
          <div className="mx-3 mt-2 relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="h-8 border-white/10 bg-white/5 pl-8 text-[12px] text-white placeholder:text-white/40 focus-visible:border-white/20"
            />
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {filteredNav.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as string}
                onClick={() => setOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg py-2 text-[13px] transition-all duration-150",
                  collapsed ? "justify-center px-2" : "px-3",
                  active
                    ? "glow-active text-white"
                    : "text-white/70 hover:bg-[var(--nav-hover)] hover:text-white hover:translate-x-[1px]",
                )}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-[var(--nav-active)] shadow-[0_0_8px_var(--nav-active)]" />
                )}
                <Icon className="h-4 w-4 shrink-0" /> {!collapsed && item.label}
              </Link>
            );
          })}
          {filteredNav.length === 0 && (
            <p className="px-3 py-6 text-center text-[11px] text-white/40">No items match "{query}"</p>
          )}
        </nav>
        <div className="border-t border-white/10 p-3 space-y-1">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="flex w-full items-center justify-center rounded-lg p-2 text-white/70 hover:bg-white/5 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            aria-label="Sign out"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-2" : "px-3",
            )}>
            <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_FULL_NAME}</p>
            <Breadcrumbs />
          </div>
          <NotificationsBell />
        </header>
        <main className="flex-1 overflow-auto bg-[var(--surface-sunken)] p-4 lg:p-6 animate-slide-fade-in"><Outlet /></main>
        <OfflineBanner />
      </div>
    </div>
  );
}