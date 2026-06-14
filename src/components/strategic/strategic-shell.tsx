import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardInsights } from "@/lib/ma.functions";
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
  Star,
  Clock3,
  X,
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
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { COLLEGE_SHORT_NAME, COLLEGE_FULL_NAME } from "@/components/erp/brand";
import { Breadcrumbs } from "@/components/erp/breadcrumbs";
import { getRecentPages, pushRecentPage } from "@/lib/ui/recent-pages-store";
import { getFavorites, toggleFavorite } from "@/lib/ui/favorites-store";

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
      { to: "/strategic/system-data", label: "System Data", icon: Database },
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
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("tvet:sidebar:collapsed") === "1";
  });
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [recent, setRecent] = useState(() => getRecentPages());

  // Approval queue badge count (live)
  const insightsFn = useServerFn(dashboardInsights);
  const insightsQ = useQuery({
    queryKey: ["nav-insights"],
    queryFn: () => insightsFn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const pendingApprovals = insightsQ.data?.pending ?? 0;

  useEffect(() => {
    const onFav = () => setFavorites(getFavorites());
    const onRec = () => setRecent(getRecentPages());
    window.addEventListener("tvet:favorites", onFav);
    window.addEventListener("tvet:recent-pages", onRec);
    return () => {
      window.removeEventListener("tvet:favorites", onFav);
      window.removeEventListener("tvet:recent-pages", onRec);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem("tvet:sidebar:collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  // Track route visits → recent pages
  useEffect(() => {
    const found = GROUPS.flatMap((g) => g.items).find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
    );
    if (found) pushRecentPage({ to: found.to, label: found.label });
  }, [location.pathname]);

  // Single-open accordion. Auto-expand the group containing the active route.
  const activeGroupId =
    GROUPS.find((g) => g.items.some((i) => isItemActive(location.pathname, i)))?.id ?? "core";
  const [openGroup, setOpenGroup] = useState<string>(activeGroupId);
  useEffect(() => {
    setOpenGroup(activeGroupId);
  }, [activeGroupId]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const allItems = useMemo(() => GROUPS.flatMap((g) => g.items), []);
  const favoriteItems = favorites
    .map((to) => allItems.find((i) => i.to === to))
    .filter(Boolean) as NavItem[];

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
          "fixed inset-y-0 left-0 z-40 flex flex-col nav-surface text-sidebar-foreground transition-all duration-200 lg:static lg:translate-x-0",
          collapsed ? "w-[68px]" : "w-64",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex items-center gap-3 pt-5 pb-3", collapsed ? "px-3 justify-center" : "px-5")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[12px] font-semibold tracking-wide text-white">{COLLEGE_SHORT_NAME}</span>
              <span className="text-[10px] uppercase tracking-widest text-white/50">Master Admin</span>
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
          <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/5">
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
        )}

        {!collapsed && (
          <div className="mx-3 mb-2 relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-7 text-[12px] text-white placeholder:text-white/40 focus:border-white/20 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-white/50 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {!collapsed && favoriteItems.length > 0 && !query && (
            <SidebarMiniSection icon={Star} title="Favorites">
              {favoriteItems.map((item) => (
                <SidebarItem
                  key={`fav-${item.to}`}
                  item={item}
                  active={isItemActive(location.pathname, item)}
                  badge={item.to === "/strategic/approvals" ? pendingApprovals : 0}
                  onNav={() => setOpen(false)}
                  favorites={favorites}
                  setFavorites={setFavorites}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMiniSection>
          )}
          {!collapsed && recent.length > 0 && !query && (
            <SidebarMiniSection icon={Clock3} title="Recent">
              {recent.slice(0, 3).map((r) => {
                const item = allItems.find((i) => i.to === r.to);
                if (!item) return null;
                return (
                  <SidebarItem
                    key={`rec-${r.to}`}
                    item={item}
                    active={isItemActive(location.pathname, item)}
                    badge={item.to === "/strategic/approvals" ? pendingApprovals : 0}
                    onNav={() => setOpen(false)}
                    favorites={favorites}
                    setFavorites={setFavorites}
                    collapsed={collapsed}
                  />
                );
              })}
            </SidebarMiniSection>
          )}
          {filteredGroups.map((group) => {
            const isOpen = openGroup === group.id;
            const showAll = collapsed || query.trim().length > 0;
            return (
              <div key={group.id} className="mb-1">
                {!collapsed && (
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
                )}
                <div
                  className={cn(
                    "grid transition-all duration-200",
                    (isOpen || showAll) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="mt-0.5 space-y-0.5 pb-1">
                      {group.items.map((item) => (
                        <SidebarItem
                          key={item.to}
                          item={item}
                          active={isItemActive(location.pathname, item)}
                          badge={item.to === "/strategic/approvals" ? pendingApprovals : 0}
                          onNav={() => setOpen(false)}
                          favorites={favorites}
                          setFavorites={setFavorites}
                          collapsed={collapsed}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredGroups.length === 0 && (
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
          <button
            onClick={signOut}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg py-2.5 text-[13px] text-white/70 hover:bg-white/5 hover:text-white",
              collapsed ? "justify-center px-2" : "px-3",
            )}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" /> {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_FULL_NAME}</span>
            <Breadcrumbs />
          </div>
          <div className="relative ml-auto max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search modules, trainers, semesters…"
              className="h-9 rounded-lg border-border/70 bg-muted/40 pl-9 text-sm shadow-none focus-visible:bg-card"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-9 w-9 rounded-lg bg-[var(--nav-active)] text-white shadow-sm hover:opacity-95"
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
        <main className="flex-1 overflow-auto bg-[var(--surface-sunken)] p-4 lg:p-6 animate-slide-fade-in">
          <Outlet />
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
}

function SidebarMiniSection({
  icon: Icon,
  title,
  children,
}: { icon: typeof Star; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        <Icon className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  badge,
  onNav,
  favorites,
  setFavorites,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNav: () => void;
  favorites: string[];
  setFavorites: (v: string[]) => void;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const isFav = favorites.includes(item.to);
  return (
    <div className="group/row relative">
      <Link
        to={item.to as string}
        onClick={onNav}
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
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
        {!collapsed && (badge ?? 0) > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--nav-active)] px-1.5 text-[10px] font-semibold text-white animate-pulse-soft">
            {badge! > 99 ? "99+" : badge}
          </span>
        )}
        {collapsed && (badge ?? 0) > 0 && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--nav-active)]" />
        )}
      </Link>
      {!collapsed && (
        <button
          type="button"
          aria-label={isFav ? "Remove favorite" : "Add favorite"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFavorites(toggleFavorite(item.to));
          }}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-white/30 opacity-0 transition-opacity hover:text-white group-hover/row:opacity-100",
            isFav && "opacity-100 text-amber",
          )}
        >
          <Star className={cn("h-3 w-3", isFav && "fill-current")} />
        </button>
      )}
    </div>
  );
}