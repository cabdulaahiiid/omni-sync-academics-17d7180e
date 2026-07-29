import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MANUAL_MODULES } from "./modules";

const STORAGE_KEY = "acme-manual-progress";

type ManualContextValue = {
  completed: Record<string, boolean>;
  toggleTask: (moduleSlug: string, taskId: string) => void;
  isComplete: (moduleSlug: string, taskId: string) => boolean;
  moduleProgress: (moduleSlug: string) => { done: number; total: number; pct: number };
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const ManualContext = createContext<ManualContextValue | null>(null);

const key = (moduleSlug: string, taskId: string) => `${moduleSlug}::${taskId}`;

export function ManualProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // localStorage is only read after hydration to avoid SSR mismatches.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCompleted(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore unreadable storage */
    }
  }, []);

  const toggleTask = useCallback((moduleSlug: string, taskId: string) => {
    setCompleted((prev) => {
      const k = key(moduleSlug, taskId);
      const next = { ...prev, [k]: !prev[k] };
      if (!next[k]) delete next[k];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore unwritable storage */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<ManualContextValue>(
    () => ({
      completed,
      toggleTask,
      isComplete: (m, t) => Boolean(completed[key(m, t)]),
      moduleProgress: (slug) => {
        const mod = MANUAL_MODULES.find((m) => m.slug === slug);
        const total = mod?.tasks.length ?? 0;
        const done = mod ? mod.tasks.filter((t) => completed[key(slug, t.id)]).length : 0;
        return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
      },
      searchOpen,
      setSearchOpen,
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((c) => !c),
    }),
    [completed, toggleTask, searchOpen, sidebarCollapsed],
  );

  return <ManualContext.Provider value={value}>{children}</ManualContext.Provider>;
}

export function useManual() {
  const ctx = useContext(ManualContext);
  if (!ctx) throw new Error("useManual must be used inside ManualProvider");
  return ctx;
}