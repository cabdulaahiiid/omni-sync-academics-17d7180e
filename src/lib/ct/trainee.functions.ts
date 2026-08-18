import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Everything the signed-in trainee needs for their current placement. */
export const getMyCtTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("student_id").eq("id", userId).maybeSingle();
    if (!profile?.student_id) return { placement: null, checkin: null, entries: [], curriculum: null };

    const { data: placement } = await supabase
      .from("ct_student_placements")
      .select(
        "id, start_date, end_date, status, enterprise_id, training_site_id, occupation_id, ct_enterprises(name, address, latitude, longitude, allowed_radius_meters), ct_enterprise_training_sites(name, location, latitude, longitude, allowed_radius_meters), ct_occupations(name)",
      )
      .eq("student_id", profile.student_id)
      .in("status", ["PENDING", "CONFIRMED", "ACTIVE"])
      .maybeSingle();
    if (!placement) return { placement: null, checkin: null, entries: [], curriculum: null };

    const [{ data: checkin }, { data: entries }, { data: modules }] = await Promise.all([
      supabase.from("ct_day1_checkins").select("*").eq("placement_id", placement.id).maybeSingle(),
      supabase
        .from("ct_daily_logbook_entries")
        .select("id, entry_date, uc_id, task_id, task_description, hours, status, created_at")
        .eq("placement_id", placement.id)
        .order("entry_date", { ascending: false })
        .limit(200),
      supabase.from("ct_training_modules").select("id").eq("occupation_id", placement.occupation_id),
    ]);

    const moduleIds = (modules ?? []).map((m) => m.id);
    const { data: ucs } = moduleIds.length
      ? await supabase
          .from("ct_units_of_competence")
          .select("id, name, sequence")
          .in("training_module_id", moduleIds)
          .order("sequence")
      : { data: [] as any[] };
    const ucIds = (ucs ?? []).map((u) => u.id);
    const { data: tasks } = ucIds.length
      ? await supabase.from("ct_training_tasks").select("id, uc_id, name, sequence").in("uc_id", ucIds).order("sequence")
      : { data: [] as any[] };

    return {
      placement: placement as any,
      checkin: checkin ?? null,
      entries: (entries ?? []) as any[],
      curriculum: { ucs: ucs ?? [], tasks: tasks ?? [] },
    };
  });

export const ctCheckinDay1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placement_id: z.string().uuid(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(100000).optional().nullable(),
        device: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("ct_checkin_day1", {
      _placement_id: data.placement_id,
      _lat: data.latitude,
      _lng: data.longitude,
      _accuracy: data.accuracy ?? null,
      _device: data.device ?? null,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; distance_m: number | null };
  });

export const ctSubmitLogbookDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        client_uuid: z.string().uuid(),
        placement_id: z.string().uuid(),
        entry_date: z.string().min(10),
        uc_id: z.string().uuid().optional().nullable(),
        task_id: z.string().uuid().optional().nullable(),
        task_description: z.string().trim().min(3).max(1000),
        hours: z.number().min(0.5).max(24),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("ct_submit_logbook_day", {
      _client_uuid: data.client_uuid,
      _placement_id: data.placement_id,
      _entry_date: data.entry_date,
      _uc_id: data.uc_id ?? null,
      _task_id: data.task_id ?? null,
      _task_description: data.task_description,
      _hours: data.hours,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { id: string; replayed: boolean };
  });
