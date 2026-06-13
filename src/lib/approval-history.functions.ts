import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Derive an ordered version timeline for a semester (and optional week)
 * from approval_queue rows + linked feedback messages.
 * Each approval_queue row = one submission/version.
 */
export const getApprovalHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid(),
      week_num: z.number().int().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Pull queue rows scoped to this semester (and week if provided).
    let scheduleIds: string[] = [];
    if (data.week_num != null) {
      const { data: sched } = await supabase
        .from("schedules")
        .select("id")
        .eq("semester_id", data.semester_id)
        .eq("week_num", data.week_num);
      scheduleIds = (sched ?? []).map((r) => r.id);
    }

    const semQuery = supabase
      .from("approval_queue")
      .select("id, type, target_id, schedule_id, decision, comment, submitted_by, decided_by, created_at, decided_at")
      .eq("type", "semester")
      .eq("target_id", data.semester_id);

    const sessQueryBase = supabase
      .from("approval_queue")
      .select("id, type, target_id, schedule_id, decision, comment, submitted_by, decided_by, created_at, decided_at")
      .eq("type", "session");

    const [{ data: semRows }, { data: sessRows }] = await Promise.all([
      semQuery,
      scheduleIds.length
        ? sessQueryBase.in("schedule_id", scheduleIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const rows = [...(semRows ?? []), ...(sessRows ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Collapse session-level rows into one "submission" per distinct created_at minute
    // so a week resubmission shows as one version, not N rows.
    const buckets = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.type === "semester"
        ? `S:${r.id}`
        : `W:${new Date(r.created_at).toISOString().slice(0, 16)}`;
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }

    const userIds = Array.from(
      new Set(
        rows.flatMap((r) => [r.submitted_by, r.decided_by]).filter(Boolean) as string[],
      ),
    );
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] as any[] };
    const nameOf = (id: string | null) => {
      if (!id) return null;
      const p = profiles?.find((x: any) => x.id === id);
      return p?.full_name || p?.email || id.slice(0, 8);
    };

    const versions = Array.from(buckets.entries()).map(([key, list], i) => {
      const first = list[0];
      const decided = list.find((r) => r.decision !== "pending") ?? first;
      return {
        version: i + 1,
        bucket_key: key,
        approval_ids: list.map((r) => r.id),
        submitted_at: first.created_at,
        submitted_by: nameOf(first.submitted_by),
        decided_at: decided.decided_at,
        decided_by: nameOf(decided.decided_by),
        decision: decided.decision as "pending" | "approved" | "rejected",
        feedback: list.map((r) => r.comment).filter(Boolean).join("\n").trim() || null,
        item_count: list.length,
      };
    });

    return { versions };
  });