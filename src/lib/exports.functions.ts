import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

const RangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
}).default({});

export const exportAttendanceCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const from = data.from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();
    const { data: rows, error } = await context.supabase
      .from("attendance_logs")
      .select("attendance_timestamp, present, student_id, schedule_id, students(full_name, registration_number), schedules(module_code, module_name, date, trainer_name)")
      .gte("attendance_timestamp", from).lte("attendance_timestamp", to)
      .order("attendance_timestamp", { ascending: false }).limit(10000);
    if (error) throw new Error(error.message);
    const flat = (rows ?? []).map((r: any) => ({
      timestamp: r.attendance_timestamp,
      present: r.present ? "YES" : "NO",
      student: r.students?.full_name ?? "",
      reg_no: r.students?.registration_number ?? "",
      module_code: r.schedules?.module_code ?? "",
      module_name: r.schedules?.module_name ?? "",
      session_date: r.schedules?.date ?? "",
      trainer: r.schedules?.trainer_name ?? "",
    }));
    return {
      filename: `attendance_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`,
      csv: toCSV(flat, ["timestamp","present","student","reg_no","module_code","module_name","session_date","trainer"]),
      count: flat.length,
    };
  });

export const exportSessionLogsCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const from = data.from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();
    const { data: rows, error } = await context.supabase
      .from("session_logs")
      .select("submitted_at, session_status, geo_verified, lesson_plan, learning_outcome, checkin_latitude, checkin_longitude, schedules(module_code, module_name, trainer_name, date, start_time, end_time)")
      .gte("submitted_at", from).lte("submitted_at", to)
      .order("submitted_at", { ascending: false }).limit(10000);
    if (error) throw new Error(error.message);
    const flat = (rows ?? []).map((r: any) => ({
      submitted_at: r.submitted_at,
      status: r.session_status,
      geo_verified: r.geo_verified ? "YES" : "NO",
      module_code: r.schedules?.module_code ?? "",
      module_name: r.schedules?.module_name ?? "",
      trainer: r.schedules?.trainer_name ?? "",
      session_date: r.schedules?.date ?? "",
      start: r.schedules?.start_time ?? "",
      end: r.schedules?.end_time ?? "",
      latitude: r.checkin_latitude ?? "",
      longitude: r.checkin_longitude ?? "",
      lesson_plan: r.lesson_plan ?? "",
      learning_outcome: r.learning_outcome ?? "",
    }));
    return {
      filename: `sessions_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`,
      csv: toCSV(flat, ["submitted_at","status","geo_verified","module_code","module_name","trainer","session_date","start","end","latitude","longitude","lesson_plan","learning_outcome"]),
      count: flat.length,
    };
  });

export const exportTrainerVelocityCSV = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const from = data.from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();
    const { data: trainers } = await context.supabase
      .from("trainer_registry").select("id, full_name, department_id");
    const { data: schedules } = await context.supabase
      .from("schedules").select("id, trainer_registry_id").gte("date", from.slice(0, 10)).lte("date", to.slice(0, 10));
    const ids = (schedules ?? []).map((s) => s.id);
    const { data: completed } = ids.length
      ? await context.supabase.from("session_logs").select("schedule_id").in("schedule_id", ids).eq("session_status", "COMPLETED")
      : { data: [] };
    const completedSet = new Set((completed ?? []).map((c) => c.schedule_id));
    const map: Record<string, { scheduled: number; completed: number }> = {};
    for (const s of schedules ?? []) {
      const key = s.trainer_registry_id;
      map[key] = map[key] ?? { scheduled: 0, completed: 0 };
      map[key].scheduled++;
      if (completedSet.has(s.id)) map[key].completed++;
    }
    const rows = (trainers ?? []).map((t) => ({
      trainer: t.full_name,
      scheduled: map[t.id]?.scheduled ?? 0,
      completed: map[t.id]?.completed ?? 0,
      velocity_pct: map[t.id]?.scheduled
        ? Math.round((map[t.id].completed / map[t.id].scheduled) * 100) : 0,
    }));
    return {
      filename: `trainer_velocity_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`,
      csv: toCSV(rows, ["trainer","scheduled","completed","velocity_pct"]),
      count: rows.length,
    };
  });