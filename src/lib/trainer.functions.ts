import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BatchSchema = z.object({
  client_uuid: z.string().uuid(),
  schedule_id: z.string().uuid(),
  client_timestamp: z.string().datetime(),
  lesson_plan: z.string().max(5000).default(""),
  learning_outcome: z.string().max(5000).default(""),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  attendance: z
    .array(z.object({ student_id: z.string().uuid(), present: z.boolean() }))
    .max(500),
});

export const submitSessionBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc("submit_session_batch", {
      _client_uuid: data.client_uuid,
      _schedule_id: data.schedule_id,
      _client_timestamp: data.client_timestamp,
      _lesson_plan: data.lesson_plan,
      _learning_outcome: data.learning_outcome,
      _latitude: data.latitude,
      _longitude: data.longitude,
      _attendance: data.attendance,
    });
    if (error) throw new Error(error.message);
    return result as {
      status: "applied" | "conflict" | "rejected";
      conflict_reason: string | null;
      replayed: boolean;
      result: { attendance_written: number; geo_distance_m: number | null; geo_ok: boolean; window_ok: boolean };
    };
  });

export const getTrainerToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("trainer_registry_id, full_name")
      .maybeSingle();
    const trainerRegistryId = profile?.trainer_registry_id;
    if (!trainerRegistryId) {
      return { trainer: null, today: [], completed: 0, total: 0 };
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const { data: schedules } = await supabase
      .from("schedules")
      .select("id, date, day, module_code, module_name, start_time, end_time, venue_id, section_id, level_id, status")
      .eq("trainer_registry_id", trainerRegistryId)
      .eq("date", dateStr)
      .order("start_time");

    const { count: total } = await supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("trainer_registry_id", trainerRegistryId);

    const { data: completedRows } = await supabase
      .from("session_logs")
      .select("schedule_id, schedules!inner(trainer_registry_id)")
      .eq("session_status", "COMPLETED")
      .eq("schedules.trainer_registry_id", trainerRegistryId);

    return {
      trainer: { id: trainerRegistryId, full_name: profile?.full_name ?? "" },
      today: schedules ?? [],
      completed: completedRows?.length ?? 0,
      total: total ?? 0,
    };
  });

export const getScheduleDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: schedule, error: sErr } = await supabase
      .from("schedules")
      .select("id, module_code, module_name, start_time, end_time, date, section_id, venue_id, level_id, department_id, trainer_registry_id")
      .eq("id", data.schedule_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const [{ data: venue }, { data: students }, { data: existingLog }, { data: existingAtt }] =
      await Promise.all([
        supabase.from("venues").select("id, name, latitude, longitude, geo_radius").eq("id", schedule.venue_id).maybeSingle(),
        supabase.from("students").select("id, full_name, registration_number").eq("section_id", schedule.section_id).order("full_name"),
        supabase.from("session_logs").select("lesson_plan, learning_outcome, session_status").eq("schedule_id", data.schedule_id).maybeSingle(),
        supabase.from("attendance_logs").select("student_id, present").eq("schedule_id", data.schedule_id),
      ]);

    return {
      schedule,
      venue,
      students: students ?? [],
      existingLog,
      existingAttendance: existingAtt ?? [],
    };
  });