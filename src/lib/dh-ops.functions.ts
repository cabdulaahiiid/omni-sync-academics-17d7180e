import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** DH KPIs scoped to their department */
export const getDHStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [trainers, students, todays, completed, attendance, leaves] = await Promise.all([
      supabase.from("trainer_registry").select("id", { count: "exact", head: true }),
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("date", today),
      supabase.from("session_logs").select("id", { count: "exact", head: true })
        .eq("session_status", "COMPLETED").gte("submitted_at", sevenDaysAgo),
      supabase.from("attendance_logs").select("present").gte("attendance_timestamp", sevenDaysAgo),
      supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    ]);

    const att = attendance.data ?? [];
    const attPct = att.length ? Math.round((att.filter((r) => r.present).length / att.length) * 100) : 0;
    return {
      trainers: trainers.count ?? 0,
      students: students.count ?? 0,
      todays_sessions: todays.count ?? 0,
      completed_7d: completed.count ?? 0,
      attendance_pct: attPct,
      pending_leaves: leaves.count ?? 0,
    };
  });

/** Sessions awaiting DH verification (submitted today, not yet acknowledged) */
export const listDHSessionFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("session_logs")
      .select("id, schedule_id, session_status, submitted_at, geo_verified, lesson_plan, learning_outcome, schedules!inner(module_code, module_name, trainer_name, date, start_time, end_time)")
      .gte("submitted_at", since)
      .order("submitted_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/** Pending leave requests */
export const listPendingLeaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select("id, trainer_registry_id, start_date, end_date, reason, status, created_at, trainer_registry!inner(full_name, email)")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["APPROVED", "REJECTED"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leave_requests").update({ status: data.decision }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: data.decision,
      entity_type: "leave_requests", entity_id: data.id,
    });
    return { ok: true };
  });

/** Override an attendance record (DH only). Inserts into attendance_overrides + updates the log. */
export const overrideAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      attendance_log_id: z.string().uuid(),
      new_value: z.boolean(),
      audit_comment: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: e1 } = await context.supabase
      .from("attendance_logs").select("id, present").eq("id", data.attendance_log_id).single();
    if (e1) throw new Error(e1.message);
    const { error: oErr } = await context.supabase.from("attendance_overrides").insert({
      attendance_log_id: data.attendance_log_id,
      old_value: existing.present,
      new_value: data.new_value,
      audit_comment: data.audit_comment,
      overridden_by: context.userId,
    });
    if (oErr) throw new Error(oErr.message);
    const { error: uErr } = await context.supabase
      .from("attendance_logs").update({ present: data.new_value }).eq("id", data.attendance_log_id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });