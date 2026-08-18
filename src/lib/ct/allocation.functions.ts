import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export const listCtPlacements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        request_id: z.string().uuid().optional().nullable(),
        status: z.enum(["PENDING", "CONFIRMED", "ACTIVE", "COMPLETED", "WITHDRAWN"]).optional().nullable(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ct_student_placements")
      .select(
        "id, request_id, student_id, enterprise_id, training_site_id, mentor_contact_id, visiting_trainer_id, department_id, occupation_id, start_date, end_date, status, locked, students(full_name, registration_number, parent_guardian_telephone), ct_enterprises(name), ct_occupations(name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.request_id) q = q.eq("request_id", data.request_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const [{ data: checkins }, { data: logs }] = await Promise.all([
      ids.length
        ? context.supabase.from("ct_day1_checkins").select("placement_id, checked_in_at, geo_verified").in("placement_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? context.supabase.from("ct_daily_logbook_entries").select("placement_id, status, hours").in("placement_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return {
      placements: (rows ?? []) as any[],
      checkins: (checkins ?? []) as any[],
      logs: (logs ?? []) as any[],
    };
  });

const allocateSchema = z.object({
  request_id: z.string().uuid(),
  schedule: z.object({
    start_date: z.string().min(10),
    end_date: z.string().min(10),
    days_per_week: z.number().int().min(1).max(7).default(5),
    daily_hours: z.number().min(1).max(12).default(8),
  }),
  allocations: z
    .array(
      z.object({
        student_id: z.string().uuid(),
        enterprise_id: z.string().uuid(),
        training_site_id: z.string().uuid().optional().nullable(),
        mentor_contact_id: z.string().uuid().optional().nullable(),
        visiting_trainer_id: z.string().uuid().optional().nullable(),
      }),
    )
    .min(1, "Assign at least one trainee to an enterprise"),
});

export const allocateCtRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => allocateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "PD", "CO"], "allocateCtRoster");
    const { data: res, error } = await context.supabase.rpc("ct_allocate_roster", {
      _request_id: data.request_id,
      _schedule: data.schedule as any,
      _allocations: data.allocations as any,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { schedule_id: string; placements: number };
  });

export const finalizeCtRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "PD"], "finalizeCtRoster");
    const { data: res, error } = await context.supabase.rpc("ct_finalize_roster", {
      _request_id: data.request_id,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { confirmed: number };
  });
