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
import { getRecentPages, pushRecentPage } from "@/lib/ui/recent-pages-store";
import { getFavorites, toggleFavorite } from "@/lib/ui/favorites-store";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDHStatsExt } from "@/lib/dashboard.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, CalendarRange,
  Activity, FileBarChart, LogOut, Menu, ShieldCheck, Upload, ClipboardCheck, GraduationCap, FileClock,
  Search, ChevronRight, Star, Clock3, Plus, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/operational")({
  component: OperationalShell,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean };
const NAV: NavItem[] = [
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
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [recent, setRecent] = useState(() => getRecentPages());

  // Live badge counts (DH stats)
  const statsFn = useServerFn(getDHStatsExt);
  const statsQ = useQuery({
    queryKey: ["dh-nav-stats"],
    queryFn: () => statsFn(),
    enabled: !!me?.roles.includes("DH") || !!me?.roles.includes("MA"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const pendingReviews = statsQ.data?.pending_reviews ?? 0;
  const missingAttendance = statsQ.data?.missing_attendance ?? 0;
  const badgeFor = (to: string) =>
    to === "/operational/drafts" ? pendingReviews :
    to === "/operational/attendance" ? missingAttendance : 0;

  useEffect(() => {
    try { localStorage.setItem("tvet:dh-sidebar:collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);
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
    const found = NAV.find((i) => i.end ? location.pathname === i.to : location.pathname.startsWith(i.to));
    if (found) pushRecentPage({ to: found.to, label: found.label });
  }, [location.pathname]);
  const q = query.trim().toLowerCase();
  const filteredNav = q ? NAV.filter((i) => i.label.toLowerCase().includes(q)) : NAV;
  const favoriteItems = favorites
    .map((to) => NAV.find((i) => i.to === to))
    .filter(Boolean) as NavItem[];

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
          <div className="mx-3 mt-2 mb-1 relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu…"
              className="h-8 border-white/10 bg-white/5 pl-8 pr-7 text-[12px] text-white placeholder:text-white/40 focus-visible:border-white/20"
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
        <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-1">
          {!collapsed && favoriteItems.length > 0 && !query && (
            <MiniSection icon={Star} title="Favorites">
              {favoriteItems.map((item) => (
                <NavRow
                  key={`fav-${item.to}`}
                  item={item}
                  active={item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)}
                  badge={badgeFor(item.to)}
                  collapsed={collapsed}
                  favorites={favorites}
                  setFavorites={setFavorites}
                  onNav={() => setOpen(false)}
                />
              ))}
            </MiniSection>
          )}
          {!collapsed && recent.length > 0 && !query && (
            <MiniSection icon={Clock3} title="Recent">
              {recent.slice(0, 3).map((r) => {
                const item = NAV.find((i) => i.to === r.to);
                if (!item) return null;
                return (
                  <NavRow
                    key={`rec-${r.to}`}
                    item={item}
                    active={item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)}
                    badge={badgeFor(item.to)}
                    collapsed={collapsed}
                    favorites={favorites}
                    setFavorites={setFavorites}
                    onNav={() => setOpen(false)}
                  />
                );
              })}
            </MiniSection>
          )}
          {filteredNav.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              active={item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)}
              badge={badgeFor(item.to)}
              collapsed={collapsed}
              favorites={favorites}
              setFavorites={setFavorites}
              onNav={() => setOpen(false)}
            />
          ))}
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
          <div className="hidden min-w-0 flex-col leading-tight lg:flex">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{COLLEGE_FULL_NAME}</p>
            <Breadcrumbs />
          </div>
          <div className="relative ml-auto max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search modules, sessions, attendance…"
              className="h-9 rounded-lg border-border/70 bg-muted/40 pl-9 text-sm shadow-none focus-visible:bg-card"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="h-9 w-9 rounded-lg bg-[var(--nav-active)] text-white shadow-sm hover:opacity-95" aria-label="Quick actions">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Quick create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/operational/semester-upload" })}>
                <Upload className="mr-2 h-4 w-4" /> Upload Semester
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/operational/drafts" })}>
                <FileClock className="mr-2 h-4 w-4" /> Submit Draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/operational/attendance" })}>
                <ClipboardCheck className="mr-2 h-4 w-4" /> Attendance
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/operational/matrix" })}>
                <CalendarRange className="mr-2 h-4 w-4" /> Open Timetable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-border hover:ring-[var(--nav-active)] transition"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-[var(--nav-bg)] text-white text-xs">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="leading-tight">
                <div className="text-sm font-semibold">{me?.profile?.full_name || "Department Head"}</div>
                <div className="text-[11px] text-muted-foreground">Department Head</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto bg-[var(--surface-sunken)] p-4 lg:p-6 animate-slide-fade-in"><Outlet /></main>
        <OfflineBanner />
      </div>
    </div>
  );
}

function MiniSection({ icon: Icon, title, children }: { icon: typeof Star; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        <Icon className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavRow({
  item, active, badge, collapsed, favorites, setFavorites, onNav,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  collapsed: boolean;
  favorites: string[];
  setFavorites: (v: string[]) => void;
  onNav: () => void;
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
        {!collapsed && badge > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--nav-active)] px-1.5 text-[10px] font-semibold text-white animate-pulse-soft">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {collapsed && badge > 0 && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--nav-active)]" />
        )}
      </Link>
      {!collapsed && (
        <button
          type="button"
          aria-label={isFav ? "Remove favorite" : "Add favorite"}
          aria-pressed={isFav}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setFavorites(toggleFavorite(item.to));
          }}
          className={cn(
            "absolute right-1.5 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white group-hover/row:flex",
            isFav && "flex text-amber-300",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", isFav && "fill-current")} />
        </button>
      )}
    </div>
  );
}