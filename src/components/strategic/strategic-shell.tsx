import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { pickHome } from "@/lib/auth/roles";
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
  Database,
  BookUser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { RoleSwitcher } from "@/components/role-switcher";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_FULL_NAME, COLLEGE_LOGO_URL } from "@/components/erp/brand";
import { Breadcrumbs } from "@/components/erp/breadcrumbs";

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
      { to: "/strategic/semesters", label: "Levels", icon: CalendarRange },
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
      { to: "/strategic/contacts", label: "Contact Book & SMS", icon: BookUser },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      { to: "/strategic/reports", label: "Reports", icon: FileBarChart },
      { to: "/strategic/system-data", label: "System Data", icon: Database },
      { to: "/strategic/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname.startsWith(item.to);
}

export function StrategicShell() {
  const { data: me, isLoading, rolesReady } = useMe();
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

  const allowed = !!me && me.roles.includes("MA");
  useEffect(() => {
    if (!rolesReady || !me) return;
    if (!allowed) {
      const home = pickHome(me.roles);
      void navigate({ to: home ?? "/login", replace: true });
    }
  }, [rolesReady, allowed, me, navigate]);

  if (isLoading || !rolesReady || (me && !allowed)) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <img src={COLLEGE_LOGO_URL} alt="Jigjiga Polytechnic College logo" className="h-9 w-9 rounded-lg bg-white object-contain p-0.5" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[12px] font-semibold tracking-wide text-white">{COLLEGE_SHORT_NAME}</span>
            <span className="text-[10px] uppercase tracking-widest text-white/50">Master Admin</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
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
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
          >
            <UserCog className="h-4 w-4" /> My profile
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <img src={COLLEGE_LOGO_URL} alt="" className="h-7 w-7 rounded object-contain" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_FULL_NAME}</span>
              <Breadcrumbs />
            </div>
          </div>
          <div className="relative ml-auto max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search modules, trainers, levels…"
              className="h-10 rounded-lg border-border/70 bg-muted/40 pl-9 text-sm shadow-none focus-visible:bg-card"
            />
          </div>
          <NotificationsBell />
          <RoleSwitcher className="ml-1 hidden sm:flex" />
          <Link
            to="/profile"
            className="ml-1 flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5 hover:bg-muted/60"
            aria-label="My profile"
          >
            <Avatar className="h-7 w-7">
              {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="" />}
              <AvatarFallback className="bg-teal/15 text-teal text-[10px] font-semibold">
                {(me?.profile?.full_name || me?.profile?.email || "U").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-[140px] truncate text-[13px] font-semibold text-foreground">
                {me?.profile?.full_name || me?.profile?.email || "User"}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {me?.roles?.includes("MA")
                  ? "Master Admin"
                  : me?.roles?.includes("DH")
                  ? "Department Head"
                  : me?.roles?.includes("T")
                  ? "Trainer"
                  : "User"}
              </span>
            </div>
          </Link>
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
                <CalendarRange className="mr-2 h-4 w-4" /> New Level
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/strategic/trainers" })}>
                <Users className="mr-2 h-4 w-4" /> New Trainer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto bg-[oklch(0.98_0.005_250)]">
          <div className="mx-auto w-full max-w-[1600px] p-3 lg:p-4"><Outlet /></div>
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
}