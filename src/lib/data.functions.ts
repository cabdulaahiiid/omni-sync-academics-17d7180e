import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Current user role + profile =====
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      roles: (roles ?? []).map((r) => r.role as "MA" | "DH" | "T"),
    };
  });

// ===== Strategic dashboard KPIs =====
export const getStrategicStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [active, pending, geo, attend, schedules, trainers, students, depts] = await Promise.all([
      supabase.from("schedules").select("*", { count: "exact", head: true })
        .eq("status", "LIVE").eq("date", today),
      supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabase.from("session_logs").select("geo_verified").gte("submitted_at", sevenDaysAgo),
      supabase.from("attendance_logs").select("present").gte("attendance_timestamp", sevenDaysAgo),
      supabase.from("schedules").select("*", { count: "exact", head: true }),
      supabase.from("trainer_registry").select("*", { count: "exact", head: true }),
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("departments").select("*", { count: "exact", head: true }),
    ]);
    const geoRows = geo.data ?? [];
    const geoPct = geoRows.length ? Math.round((geoRows.filter((r) => r.geo_verified).length / geoRows.length) * 100) : 0;
    const attRows = attend.data ?? [];
    const attPct = attRows.length ? Math.round((attRows.filter((r) => r.present).length / attRows.length) * 100) : 0;
    return {
      active_sessions: active.count ?? 0,
      pending_approvals: pending.count ?? 0,
      geo_compliance: geoPct,
      attendance_pct: attPct,
      trainer_punctuality: geoPct, // proxy until checkin time data exists
      counts: {
        departments: depts.count ?? 0,
        trainers: trainers.count ?? 0,
        students: students.count ?? 0,
        schedules: schedules.count ?? 0,
      },
    };
  });

// ===== Departments CRUD =====
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const departmentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => departmentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      description: data.description ?? null,
      status: data.status,
    };
    let result;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("departments").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      result = row;
    } else {
      const { data: row, error } = await supabase
        .from("departments").insert(payload).select().single();
      if (error) throw new Error(error.message);
      result = row;
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: data.id ? "UPDATE" : "CREATE",
      entity_type: "departments",
      entity_id: result.id,
      after_state: result,
    });
    return result;
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "DELETE",
      entity_type: "departments",
      entity_id: data.id,
    });
    return { ok: true };
  });

// ===== Audit logs (live activity feed) =====
export const listRecentAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("id, action_type, entity_type, entity_id, actor_id, timestamp")
      .order("timestamp", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ===== Approval queue =====
export const listApprovalQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schedules")
      .select("id, date, day, start_time, end_time, module_code, module_name, trainer_name, status, admin_feedback")
      .in("status", ["PENDING", "FEEDBACK_REQUIRED"])
      .order("date", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.id);
    let queueMap: Record<string, { conflict_trainer: boolean; conflict_venue: boolean; invalid_qualification: boolean; excessive_load: boolean }> = {};
    if (ids.length) {
      const { data: queue } = await context.supabase
        .from("approval_queue").select("schedule_id, conflict_trainer, conflict_venue, invalid_qualification, excessive_load")
        .in("schedule_id", ids);
      queueMap = Object.fromEntries((queue ?? []).map((q) => [q.schedule_id, q]));
    }
    return (data ?? []).map((s) => ({ ...s, flags: queueMap[s.id] ?? null }));
  });

// Conflict detection: writes flags into approval_queue
async function computeConflicts(supabase: any, scheduleId: string) {
  const { data: s } = await supabase.from("schedules").select("*").eq("id", scheduleId).single();
  if (!s) return null;
  // Trainer overlap
  const { data: trainerOverlap } = await supabase.from("schedules").select("id")
    .eq("trainer_registry_id", s.trainer_registry_id)
    .eq("date", s.date)
    .neq("id", s.id)
    .lt("start_time", s.end_time)
    .gt("end_time", s.start_time);
  // Venue overlap
  const { data: venueOverlap } = await supabase.from("schedules").select("id")
    .eq("venue_id", s.venue_id)
    .eq("date", s.date)
    .neq("id", s.id)
    .lt("start_time", s.end_time)
    .gt("end_time", s.start_time);
  // Qualification check
  const { data: mod } = await supabase.from("modules").select("qualifications").eq("code", s.module_code).maybeSingle();
  const { data: skills } = await supabase.from("trainer_skills").select("module_code")
    .eq("trainer_registry_id", s.trainer_registry_id);
  const trainerModules = new Set((skills ?? []).map((x: any) => x.module_code));
  const qualOk = mod?.qualifications?.length
    ? mod.qualifications.some((q: string) => trainerModules.has(q)) || trainerModules.has(s.module_code)
    : trainerModules.has(s.module_code);
  // Load check (>8h same day)
  const { data: dayLoad } = await supabase.from("schedules").select("start_time, end_time")
    .eq("trainer_registry_id", s.trainer_registry_id).eq("date", s.date);
  const totalMinutes = (dayLoad ?? []).reduce((acc: number, r: any) => {
    const [sh, sm] = r.start_time.split(":").map(Number);
    const [eh, em] = r.end_time.split(":").map(Number);
    return acc + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const flags = {
    schedule_id: scheduleId,
    conflict_trainer: (trainerOverlap?.length ?? 0) > 0,
    conflict_venue: (venueOverlap?.length ?? 0) > 0,
    invalid_qualification: !qualOk,
    excessive_load: totalMinutes > 8 * 60,
  };
  await supabase.from("approval_queue").upsert(flags, { onConflict: "schedule_id" });
  return flags;
}

export const checkScheduleConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => computeConflicts(context.supabase, data.schedule_id));

export const approveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedules")
      .update({ status: "LIVE", admin_feedback: null }).eq("id", data.schedule_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "APPROVE", entity_type: "schedules", entity_id: data.schedule_id,
    });
    return { ok: true };
  });

export const sendBackSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schedule_id: z.string().uuid(), feedback: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedules")
      .update({ status: "FEEDBACK_REQUIRED", admin_feedback: data.feedback }).eq("id", data.schedule_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "SEND_BACK", entity_type: "schedules", entity_id: data.schedule_id,
      after_state: { feedback: data.feedback },
    });
    return { ok: true };
  });

// ===== Department comparison =====
export const getDepartmentComparison = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: depts } = await context.supabase.from("departments").select("id, name");
    const { data: schedules } = await context.supabase.from("schedules").select("id, department_id");
    const schedToDept = new Map((schedules ?? []).map((s: any) => [s.id, s.department_id]));
    const { data: logs } = await context.supabase.from("attendance_logs")
      .select("present, schedule_id").gte("attendance_timestamp", sevenDaysAgo);
    const tally: Record<string, { present: number; total: number }> = {};
    for (const l of logs ?? []) {
      const deptId = schedToDept.get((l as any).schedule_id);
      if (!deptId) continue;
      tally[deptId] = tally[deptId] ?? { present: 0, total: 0 };
      tally[deptId].total++;
      if ((l as any).present) tally[deptId].present++;
    }
    return (depts ?? []).map((d) => ({
      name: d.name,
      attendance: tally[d.id]?.total ? Math.round((tally[d.id].present / tally[d.id].total) * 100) : 0,
    }));
  });

// ===== Override logs =====
export const listRecentOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attendance_overrides")
      .select("id, audit_comment, override_timestamp, old_value, new_value")
      .order("override_timestamp", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });