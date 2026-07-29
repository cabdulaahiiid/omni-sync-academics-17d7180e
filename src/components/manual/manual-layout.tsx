import { useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Settings, Menu, Search, Printer, BookOpen, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { MANUAL_MODULES } from "@/lib/manual/modules";
import { ManualProvider, useManual } from "@/lib/manual/manual-context";

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="space-y-1">
      <Link
        to="/manual"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/manual"
            ? "bg-primary text-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Manual home</span>}
      </Link>
      {!collapsed && (
        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Modules
        </p>
      )}
      {MANUAL_MODULES.map((m) => {
        const active = pathname === `/manual/modules/${m.slug}`;
        const Icon = m.icon;
        return (
          <Link
            key={m.slug}
            to="/manual/modules/$slug"
            params={{ slug: m.slug }}
            onClick={onNavigate}
            title={m.title}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{m.title}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/manual" className="flex items-center gap-2.5 px-1">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Settings className="h-5 w-5" />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-sm font-bold text-foreground">Acme Corp</span>
          <span className="block text-[11px] text-muted-foreground">ERP User Manual</span>
        </span>
      )}
    </Link>
  );
}

function SearchPalette() {
  const { searchOpen, setSearchOpen } = useManual();
  const navigate = useNavigate();
  const go = (slug: string) => {
    setSearchOpen(false);
    navigate({ to: "/manual/modules/$slug", params: { slug } });
  };
  return (
    <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
      <CommandInput placeholder="Search modules and tasks…" />
      <CommandList>
        <CommandEmpty>No matching topic.</CommandEmpty>
        <CommandGroup heading="Modules">
          {MANUAL_MODULES.map((m) => (
            <CommandItem key={m.slug} value={`${m.title} ${m.short}`} onSelect={() => go(m.slug)}>
              <m.icon className="mr-2 h-4 w-4" />
              {m.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Tasks">
          {MANUAL_MODULES.flatMap((m) =>
            m.tasks.map((t) => (
              <CommandItem
                key={`${m.slug}-${t.id}`}
                value={`${t.title} ${m.title}`}
                onSelect={() => go(m.slug)}
              >
                <span className="truncate">{t.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{m.short}</span>
              </CommandItem>
            )),
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function Shell() {
  const { setSearchOpen, sidebarCollapsed, toggleSidebar } = useManual();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="manual-theme flex min-h-screen">
      <aside
        className={cn(
          "manual-no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex",
          sidebarCollapsed ? "w-[72px]" : "w-64",
        )}
      >
        <div className="mb-4 pt-1">
          <Brand collapsed={sidebarCollapsed} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList collapsed={sidebarCollapsed} />
        </div>
        <Button variant="ghost" size="sm" onClick={toggleSidebar} className="mt-2 justify-start gap-2">
          {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="manual-no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="manual-theme w-72 bg-sidebar p-3">
              <SheetTitle className="sr-only">Manual navigation</SheetTitle>
              <div className="mb-4 pt-1"><Brand /></div>
              <NavList onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="lg:hidden"><Brand collapsed /></div>
          <span className="hidden text-sm font-semibold text-foreground lg:inline">
            Acme Corp — ERP User Manual
          </span>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="gap-2 text-muted-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline">⌘K</kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </header>

        <main className="manual-print-area mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8 lg:py-10">
          <Outlet />
        </main>

        <footer className="manual-no-print border-t border-border px-4 py-4 text-center text-xs text-muted-foreground lg:px-8">
          © {new Date().getFullYear()} Acme Corp — ERP User Manual · Version 1.0
        </footer>
      </div>

      <SearchPalette />
    </div>
  );
}

export function ManualLayout() {
  return (
    <ManualProvider>
      <Shell />
    </ManualProvider>
  );
}