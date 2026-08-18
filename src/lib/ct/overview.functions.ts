import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** KPI tiles + recent workflow activity for the cooperative training overview. */
export const getCtOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [requests, placements, pendingLogs, absences, queue, events, enterprises] = await Promise.all([
      supabase.from("ct_training_requests").select("id, status"),
      supabase.from("ct_student_placements").select("id, status"),
      supabase.from("ct_daily_logbook_entries").select("id", { count: "exact", head: true }).eq("status", "SUBMITTED"),
      supabase.from("ct_absence_events").select("id", { count: "exact", head: true }),
      supabase.from("ct_assessment_queue").select("id", { count: "exact", head: true }).eq("status", "QUEUED"),
      supabase
        .from("ct_workflow_events")
        .select("id, entity_type, entity_id, event_type, created_at, payload")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("ct_enterprises").select("id, max_capacity, active").eq("active", true),
    ]);

    const reqRows = requests.data ?? [];
    const plRows = placements.data ?? [];
    const capacity = (enterprises.data ?? []).reduce((s, e) => s + (e.max_capacity ?? 0), 0);
    const occupied = plRows.filter((p) => ["PENDING", "CONFIRMED", "ACTIVE"].includes(p.status)).length;

    return {
      requests_total: reqRows.length,
      requests_pending: reqRows.filter((r) => ["SUBMITTED", "DELEGATED"].includes(r.status)).length,
      placements_active: plRows.filter((p) => p.status === "ACTIVE").length,
      placements_completed: plRows.filter((p) => p.status === "COMPLETED").length,
      logbook_pending: pendingLogs.count ?? 0,
      absences: absences.count ?? 0,
      assessment_queue: queue.count ?? 0,
      capacity,
      occupied,
      events: (events.data ?? []) as any[],
    };
  });
