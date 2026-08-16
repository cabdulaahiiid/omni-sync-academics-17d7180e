import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * One channel drives every Department Head schedule surface.
 *
 * Events never patch the cache — they invalidate the canonical queries, so a
 * duplicate event is a no-op and the database stays the single source of
 * truth. On reconnect the same invalidation runs, so nothing missed while the
 * socket was down stays stale.
 */
const DH_TABLES = [
  "schedules",
  "schedule_plans",
  "semester_registry",
  "approval_queue",
  "schedule_feedback_threads",
  "schedule_feedback_messages",
  "notifications",
] as const;

export const DH_QUERY_ROOTS = [
  "semester-drafts",
  "draft-modules",
  "builder-options",
  "builder-validate",
  "semester-sessions",
  "week-timetable",
  "week-feedback-threads",
  "dh-stats",
  "dh-sched",
  "dh-active",
  "dh-alerts",
] as const;

export function useDhScheduleLive(departmentId: string | null | undefined, extraRoots: readonly string[] = []) {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootsSig = extraRoots.slice().sort().join(",");

  useEffect(() => {
    const roots = new Set<string>([...DH_QUERY_ROOTS, ...extraRoots]);
    const invalidateAll = () => {
      for (const root of roots) qc.invalidateQueries({ queryKey: [root] });
    };
    const schedule = () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        invalidateAll();
      }, 250);
    };

    const channel = supabase.channel(`dh-schedule-${departmentId ?? "all"}`);
    for (const table of DH_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe((status) => {
      // Refetch after a (re)connect rather than assuming nothing was missed.
      if (status === "SUBSCRIBED") invalidateAll();
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, rootsSig, qc]);
}