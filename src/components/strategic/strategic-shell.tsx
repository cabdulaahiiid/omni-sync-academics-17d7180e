import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import {
  LayoutDashboard,
  Building2,
  UserCog,
  Users,
  GraduationCap,
  BookOpen,
  MapPin,
  Layers,
  Grid3x3,
  CalendarRange,
  ShieldCheck,
  ScrollText,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
const NAV: NavItem[] = [
  { to: "/strategic", label: "Command Center", icon: LayoutDashboard, end: true },
  { to: "/strategic/departments", label: "Departments", icon: Building2 },
  { to: "/strategic/department-heads", label: "Department Heads", icon: UserCog },
  { to: "/strategic/trainers", label: "Trainers", icon: Users },
  { to: "/strategic/students", label: "Students", icon: GraduationCap },
  { to: "/strategic/modules", label: "Modules", icon: BookOpen },
  { to: "/strategic/venues", label: "Venues", icon: MapPin },
  { to: "/strategic/levels", label: "Levels", icon: Layers },
  { to: "/strategic/sections", label: "Sections", icon: Grid3x3 },
  { to: "/strategic/semesters", label: "Semesters", icon: CalendarRange },
  { to: "/strategic/users", label: "Users & Roles", icon: ShieldCheck },
  { to: "/strategic/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/strategic/settings", label: "Settings", icon: Settings },
];

export function StrategicShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!me?.roles.includes("MA")) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted-foreground">This area is for Master Administrators only.</p>
        </div>
      </div>
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wider text-white">TVET OMNI-SYNC</span>
            <span className="text-[10px] uppercase tracking-widest text-white/60">Master Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <Avatar className="h-10 w-10 ring-2 ring-white/10">
            <AvatarFallback className="bg-white/10 text-white text-xs">
              {(me?.profile?.full_name || me?.profile?.email || "MA").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{me?.profile?.full_name || "Administrator"}</p>
            <p className="truncate text-[11px] text-white/60">Master Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as string}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-white/10 text-white shadow-sm" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-background px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Master Administrator</p>
            <p className="text-sm font-medium">{me?.profile?.full_name || me?.profile?.email}</p>
          </div>
          <Button size="sm" className="rounded-xl">+ Profile</Button>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}