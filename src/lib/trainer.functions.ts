import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server-anchored clock used by trainer UI countdowns. Cheap; no DB roundtrip.
export const getServerTime = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ now: new Date().toISOString() }));

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
      _latitude: (data.latitude ?? 0) as number,
      _longitude: (data.longitude ?? 0) as number,
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
      .eq("is_published", true)
      .eq("date", dateStr)
      .order("start_time");

    const { count: total } = await supabase
      .from("schedules")
      .select("id", { count: "exact", head: true })
      .eq("trainer_registry_id", trainerRegistryId)
      .eq("is_published", true);

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
      .select("id, module_code, module_name, start_time, end_time, date, section_id, venue_id, level_id, department_id, trainer_registry_id, mode, checkin_at, ended_at, status")
      .eq("id", data.schedule_id)
      .single();
    if (sErr) throw new Error(sErr.message);

    const [{ data: venue }, { data: students }, { data: existingLog }, { data: existingAtt }, { data: dept }, { data: level }, { data: moduleRow }, { data: section }] =
      await Promise.all([
        supabase.from("venues").select("id, name, latitude, longitude, geo_radius").eq("id", schedule.venue_id).maybeSingle(),
        supabase.from("students").select("id, full_name, registration_number").eq("section_id", schedule.section_id).order("full_name"),
        supabase.from("session_logs").select("lesson_plan, learning_outcome, session_status").eq("schedule_id", data.schedule_id).maybeSingle(),
        supabase.from("attendance_logs").select("student_id, present").eq("schedule_id", data.schedule_id),
        supabase.from("departments").select("id, name").eq("id", schedule.department_id).maybeSingle(),
        supabase.from("levels").select("id, name, display_name").eq("id", schedule.level_id).maybeSingle(),
        supabase.from("modules").select("code, total_hours, total_sessions").eq("code", schedule.module_code).maybeSingle(),
        supabase.from("sections").select("id, name").eq("id", schedule.section_id).maybeSingle(),
      ]);

    // Session number = count of this trainer's COMPLETED session_logs for this module up to/including today + 1 for the in-progress one
    const { count: completedForModule } = await supabase
      .from("session_logs")
      .select("id, schedules!inner(module_code, trainer_registry_id)", { count: "exact", head: true })
      .eq("session_status", "COMPLETED")
      .eq("schedules.module_code", schedule.module_code)
      .eq("schedules.trainer_registry_id", schedule.trainer_registry_id);

    return {
      schedule,
      venue,
      students: students ?? [],
      existingLog,
      existingAttendance: existingAtt ?? [],
      department: dept,
      level,
      module: moduleRow,
      section,
      session_number: (completedForModule ?? 0) + (schedule.status === "ENDED" ? 0 : 1),
    };
  });

// ---------- Step 4: set mode ----------
export const setSessionMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      mode: z.enum(["Theory", "Practical", "Both"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_session_mode", {
      _schedule_id: data.schedule_id,
      _mode: data.mode,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Step 5/6: 30-minute / 200m gatekeeper check-in ----------
export const trainerCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      latitude: z.number(),
      longitude: z.number(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("trainer_checkin", {
      _schedule_id: data.schedule_id,
      _latitude: data.latitude,
      _longitude: data.longitude,
    });
    if (error) throw new Error(error.message);
    return result as { checkin_at: string; roster_unlock_until: string; distance_m: number | null };
  });

// ---------- Step 9/10: end session ----------
export const trainerEndSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      learning_outcome: z.string().min(5).max(5000),
      lesson_plan: z.string().min(5).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("trainer_end_session", {
      _schedule_id: data.schedule_id,
      _learning_outcome: data.learning_outcome,
      _lesson_plan: data.lesson_plan,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Step 11: progress counter ----------
export const getMyProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("trainer_registry_id").maybeSingle();
    if (!profile?.trainer_registry_id) return { completed: 0, target: 15 };
    const { data: tr } = await context.supabase
      .from("trainer_registry")
      .select("sessions_completed, sessions_target")
      .eq("id", profile.trainer_registry_id)
      .maybeSingle();
    return {
      completed: tr?.sessions_completed ?? 0,
      target: tr?.sessions_target ?? 15,
    };
  });

export const getTrainerSessionsDetailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ scope: z.enum(["today", "upcoming"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("profiles").select("trainer_registry_id").maybeSingle();
    const trainerId = profile?.trainer_registry_id;
    if (!trainerId) return [];
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let q = supabase
      .from("schedules")
      .select("id, date, day, start_time, end_time, module_code, module_name, status, venue_id, section_id")
      .eq("trainer_registry_id", trainerId)
      .eq("is_published", true);
    if (data.scope === "today") q = q.eq("date", dateStr);
    else q = q.gt("date", dateStr);
    const { data: rows, error } = await q.order("date").order("start_time").limit(200);
    if (error) throw new Error(error.message);
    const venueIds = Array.from(new Set((rows ?? []).map((r) => r.venue_id).filter(Boolean))) as string[];
    const sectionIds = Array.from(new Set((rows ?? []).map((r) => r.section_id).filter(Boolean))) as string[];
    const [{ data: venues }, { data: sections }] = await Promise.all([
      venueIds.length
        ? supabase.from("venues").select("id, name").in("id", venueIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      sectionIds.length
        ? supabase.from("sections").select("id, name").in("id", sectionIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const vMap = new Map((venues ?? []).map((v) => [v.id, v.name]));
    const sMap = new Map((sections ?? []).map((s) => [s.id, s.name]));
    return (rows ?? []).map((r) => ({
      ...r,
      venue_name: r.venue_id ? vMap.get(r.venue_id) ?? "" : "",
      section_name: r.section_id ? sMap.get(r.section_id) ?? "" : "",
    }));
  });