import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to realtime changes on a set of public tables and invalidate
 * matching React Query keys when any row changes. Debounces bursts.
 *
 * Each table name is also used as the query-key root for invalidation, so
 * structure your queryKeys like ["schedules", ...args] for automatic refetch.
 * You can pass extra root keys via `invalidateRoots` to refresh derived
 * dashboard queries that aggregate the listed tables.
 */
export function useLiveTables(
  tables: readonly string[],
  invalidateRoots: readonly string[] = [],
) {
  const qc = useQueryClient();
  const tableSig = tables.slice().sort().join(",");
  const rootSig = invalidateRoots.slice().sort().join(",");
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tables.length === 0) return;
    const flush = () => {
      const hit = Array.from(pending.current);
      pending.current.clear();
      timer.current = null;
      const roots = new Set<string>([...hit, ...invalidateRoots]);
      for (const root of roots) {
        qc.invalidateQueries({ queryKey: [root] });
      }
    };
    const enqueue = (table: string) => {
      pending.current.add(table);
      if (timer.current) return;
      timer.current = setTimeout(flush, 250);
    };
    const channel = supabase.channel(`live-${tableSig}-${Math.random().toString(36).slice(2, 8)}`);
    for (const t of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        () => enqueue(t),
      );
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current.clear();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableSig, rootSig, qc]);
}
