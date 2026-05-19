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
  CheckSquare,
  BarChart3,
  FileBarChart,
  ChevronRight,
  Search,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
type NavGroup = { id: string; label: string; items: NavItem[] };
const GROUPS: NavGroup[] = [
  {
    id: "core",
    label: "Core Operations",
    items: [
      { to: "/strategic", label: "Command Center", icon: LayoutDashboard, end: true },
      { to: "/strategic/insights", label: "Insights", icon: BarChart3 },
      { to: "/strategic/approvals", label: "Approvals", icon: CheckSquare },
      { to: "/strategic/audit", label: "Audit Logs", icon: ScrollText },
    ],
  },
  {
    id: "academic",
    label: "Academic & Structure",
    items: [
      { to: "/strategic/departments", label: "Departments", icon: Building2 },
      { to: "/strategic/modules", label: "Modules", icon: BookOpen },
      { to: "/strategic/venues", label: "Venues", icon: MapPin },
      { to: "/strategic/levels", label: "Levels", icon: Layers },
      { to: "/strategic/sections", label: "Sections", icon: Grid3x3 },
      { to: "/strategic/semesters", label: "Semesters", icon: CalendarRange },
    ],
  },
  {
    id: "users",
    label: "User Management",
    items: [
      { to: "/strategic/department-heads", label: "Department Heads", icon: UserCog },
      { to: "/strategic/trainers", label: "Trainers", icon: Users },
      { to: "/strategic/students", label: "Students", icon: GraduationCap },
      { to: "/strategic/users", label: "Users & Roles", icon: ShieldCheck },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { to: "/strategic/reports", label: "Reports", icon: FileBarChart },
      { to: "/strategic/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

export function StrategicShell() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Single-open accordion. Auto-expand the group containing the active route.
  const activeGroupId =
    GROUPS.find((g) => g.items.some((i) => isItemActive(location.pathname, i)))?.id ?? "core";
  const [openGroup, setOpenGroup] = useState<string>(activeGroupId);
  useEffect(() => {
    setOpenGroup(activeGroupId);
  }, [activeGroupId]);

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
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-wider text-white">TVET OMNI-SYNC</span>
            <span className="text-[10px] uppercase tracking-widest text-white/50">Master Admin</span>
          </div>
        </div>
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <Avatar className="h-9 w-9 ring-2 ring-white/10">
            <AvatarFallback className="bg-white/15 text-white text-xs">
              {(me?.profile?.full_name || me?.profile?.email || "MA").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">
              {me?.profile?.full_name || "Administrator"}
            </p>
            <p className="truncate text-[10px] text-white/55">Master Admin</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {GROUPS.map((group) => {
            const isOpen = openGroup === group.id;
            return (
              <div key={group.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? "" : group.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45 hover:text-white/80"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-200",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mt-0.5 space-y-0.5 pb-1">
                      {group.items.map((item) => {
                        const active = isItemActive(location.pathname, item);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to as string}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                              active
                                ? "bg-white/10 text-white"
                                : "text-white/65 hover:bg-white/5 hover:text-white",
                            )}
                          >
                            {active && (
                              <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-teal" />
                            )}
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search wide search..."
              className="h-10 rounded-lg border-border/70 bg-muted/40 pl-9 text-sm shadow-none focus-visible:bg-card"
            />
          </div>
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-10 w-10 rounded-lg bg-teal text-teal-fg shadow-sm hover:bg-teal/90"
                aria-label="Quick actions"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Quick create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/departments" })}>
                <Building2 className="mr-2 h-4 w-4" /> New Department
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/modules" })}>
                <BookOpen className="mr-2 h-4 w-4" /> New Module
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/venues" })}>
                <MapPin className="mr-2 h-4 w-4" /> New Venue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/semesters" })}>
                <CalendarRange className="mr-2 h-4 w-4" /> New Semester
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/trainers" })}>
                <Users className="mr-2 h-4 w-4" /> New Trainer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto bg-[oklch(0.98_0.005_250)] p-4 lg:p-6">
          <Outlet />
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
}