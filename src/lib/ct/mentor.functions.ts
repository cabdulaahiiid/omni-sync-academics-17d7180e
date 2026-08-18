import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Logbook entries waiting for the signed-in mentor (RLS scopes to their enterprise). */
export const listCtMentorQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: placements, error } = await context.supabase
      .from("ct_student_placements")
      .select("id, student_id, start_date, end_date, status, students(full_name, registration_number), ct_enterprises(name)")
      .in("status", ["CONFIRMED", "ACTIVE"])
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (placements ?? []).map((p) => p.id);
    const { data: entries } = ids.length
      ? await context.supabase
          .from("ct_daily_logbook_entries")
          .select("id, placement_id, entry_date, task_description, hours, status, submitted_at")
          .in("placement_id", ids)
          .order("entry_date", { ascending: false })
          .limit(400)
      : { data: [] as any[] };
    return { placements: (placements ?? []) as any[], entries: (entries ?? []) as any[] };
  });

export const ctDecideLogbook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        entry_id: z.string().uuid(),
        decision: z.enum(["APPROVED", "REJECTED"]),
        comment: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_mentor_decide_logbook", {
      _entry_id: data.entry_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
