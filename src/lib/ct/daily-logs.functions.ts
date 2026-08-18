import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Trainees assigned to the signed-in industry trainer (RLS scopes to their enterprise). */
export const listCtIndustryRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: placements, error } = await context.supabase
      .from("ct_student_placements")
      .select(
        "id, student_id, department_id, start_date, end_date, status, students(full_name, registration_number), ct_enterprises(name)",
      )
      .in("status", ["CONFIRMED", "ACTIVE"])
      .order("start_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = (placements ?? []).map((p: any) => p.id);
    const { data: logs } = ids.length
      ? await ((context.supabase.from("ct_daily_practical_logs" as any) as any)
          .select("id, placement_id, log_date, attendance, shift_hours, score, safety_breach, task_notes, safety_notes, gap_tags")
          .in("placement_id", ids)
          .order("log_date", { ascending: false })
          .limit(500))
      : { data: [] as any[] };
    const deptIds = Array.from(new Set((placements ?? []).map((p: any) => p.department_id).filter(Boolean)));
    const { data: competencies } = deptIds.length
      ? await ((context.supabase.from("ct_department_competencies" as any) as any)
          .select("id, department_id, name, critical, sort_order")
          .in("department_id", deptIds)
          .eq("active", true)
          .order("sort_order"))
      : { data: [] as any[] };
    return {
      placements: (placements ?? []) as any[],
      logs: (logs ?? []) as any[],
      competencies: (competencies ?? []) as any[],
    };
  });

export const dailyLogSchema = z.object({
  client_uuid: z.string().uuid(),
  placement_id: z.string().uuid(),
  log_date: z.string().min(8),
  attendance: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
  shift_hours: z.coerce.number().min(0).max(24),
  score: z.coerce.number().int().min(1).max(5).nullable().optional(),
  safety_breach: z.boolean().default(false),
  task_notes: z.string().trim().max(1000).optional().nullable(),
  safety_notes: z.string().trim().max(1000).optional().nullable(),
  gap_tags: z.array(z.string().trim().min(1).max(120)).default([]),
});

export const submitCtDailyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dailyLogSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase.rpc as any)("ct_submit_daily_log", {
      _client_uuid: data.client_uuid,
      _placement_id: data.placement_id,
      _log_date: data.log_date,
      _attendance: data.attendance,
      _shift_hours: data.shift_hours,
      _score: data.score ?? null,
      _safety_breach: data.safety_breach,
      _task_notes: data.task_notes ?? null,
      _safety_notes: data.safety_notes ?? null,
      _gap_tags: data.gap_tags,
    });
    if (error) throw new Error(error.message);
    return res as { id: string; duplicate: boolean };
  });
