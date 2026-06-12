import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
//                       STRATEGIC (MASTER ADMIN) DASHBOARD
// ============================================================================

function startOfTodayISO() { return new Date(new Date().toDateString()).toISOString(); }
function todayDate() { return new Date().toISOString().slice(0, 10); }
function nowIso() { return new Date().toISOString(); }
function daysAgoISO(n: number) { return new Date(Date.now() - n * 86400000).toISOString(); }
function isoWeekKey(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Extended Strategic KPIs with real punctuality and departments-reporting count. */
export const getStrategicStatsExt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = todayDate();
    const sevenDaysAgo = daysAgoISO(7);
    const prevSevenDaysAgo = daysAgoISO(14);

    const [active, pending, geo, geoPrev, attend, attendPrev, schedulesToday, schedulesPrev, depts] = await Promise.all([
      supabase.from("schedules").select("*", { count: "exact", head: true })
        .in("status", ["LIVE", "ACTIVE"]).eq("date", today),
      supabase.from("approval_queue").select("*", { count: "exact", head: true }).eq("decision", "pending"),
      supabase.from("session_logs").select("geo_verified").gte("submitted_at", sevenDaysAgo),
      supabase.from("session_logs").select("geo_verified").gte("submitted_at", prevSevenDaysAgo).lt("submitted_at", sevenDaysAgo),
      supabase.from("attendance_logs").select("present").gte("attendance_timestamp", sevenDaysAgo),
      supabase.from("attendance_logs").select("present").gte("attendance_timestamp", prevSevenDaysAgo).lt("attendance_timestamp", sevenDaysAgo),
      supabase.from("schedules").select("department_id, checkin_at, start_time, date").eq("date", today),
      supabase.from("schedules").select("checkin_at, start_time, date").gte("date", daysAgoISO(8).slice(0, 10)).lt("date", today),
      supabase.from("departments").select("id", { count: "exact", head: true }),
    ]);

    const geoPct = (rows: { geo_verified: boolean | null }[] | null) => {
      const r = rows ?? [];
      return r.length ? Math.round((r.filter((x) => x.geo_verified).length / r.length) * 100) : 0;
    };
    const attPct = (rows: { present: boolean | null }[] | null) => {
      const r = rows ?? [];
      return r.length ? Math.round((r.filter((x) => x.present).length / r.length) * 100) : 0;
    };

    // Punctuality = % of checkins within 15min of start_time
    const punctuality = (rows: any[] | null) => {
      const arr = (rows ?? []).filter((r) => r.checkin_at && r.start_time && r.date);
      if (!arr.length) return 0;
      let ok = 0;
      for (const r of arr) {
        const start = new Date(`${r.date}T${r.start_time}`).getTime();
        const checkin = new Date(r.checkin_at).getTime();
        if (checkin - start <= 15 * 60_000) ok++;
      }
      return Math.round((ok / arr.length) * 100);
    };

    const reportingToday = new Set((schedulesToday.data ?? []).map((r: any) => r.department_id)).size;
    const geoNow = geoPct(geo.data ?? []);
    const geoPrevPct = geoPct(geoPrev.data ?? []);
    const attNow = attPct(attend.data ?? []);
    const attPrevPct = attPct(attendPrev.data ?? []);
    const punctNow = punctuality(schedulesToday.data ?? []);
    const punctPrev = punctuality(schedulesPrev.data ?? []);

    const delta = (now: number, prev: number) => (prev === 0 ? null : Math.round(((now - prev) / prev) * 100));

    return {
      active_sessions: active.count ?? 0,
      pending_approvals: pending.count ?? 0,
      attendance_pct: attNow,
      attendance_delta: delta(attNow, attPrevPct),
      trainer_punctuality: punctNow,
      trainer_punctuality_delta: delta(punctNow, punctPrev),
      geo_compliance: geoNow,
      geo_compliance_delta: delta(geoNow, geoPrevPct),
      departments_reporting: reportingToday,
      departments_total: depts.count ?? 0,
      updated_at: nowIso(),
    };
  });

/** Counts for the Approval Queue summary panel. */
export const getApprovalQueueSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const startToday = startOfTodayISO();
    const [pending, approvedToday, returned, rejected] = await Promise.all([
      supabase.from("approval_queue").select("*", { count: "exact", head: true }).eq("decision", "pending"),
      supabase.from("approval_queue").select("*", { count: "exact", head: true })
        .eq("decision", "approved").gte("decided_at", startToday),
      // "Returned" = rejected within 7 days (DH still needs to fix) -- use 7-day window
      supabase.from("approval_queue").select("*", { count: "exact", head: true })
        .eq("decision", "rejected").gte("decided_at", daysAgoISO(7)),
      supabase.from("approval_queue").select("*", { count: "exact", head: true }).eq("decision", "rejected"),
    ]);
    return {
      pending: pending.count ?? 0,
      approved_today: approvedToday.count ?? 0,
      returned: returned.count ?? 0,
      rejected: rejected.count ?? 0,
    };
  });

/** Today's institution activity rollup. */
export const getInstitutionActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = todayDate();
    const startToday = startOfTodayISO();

    const [sched, logs, atts] = await Promise.all([
      supabase.from("schedules").select("id, status, start_time, end_time, checkin_at").eq("date", today),
      supabase.from("session_logs").select("schedule_id, session_status, submitted_at").gte("submitted_at", startToday),
      supabase.from("attendance_logs").select("id, present, attendance_timestamp").gte("attendance_timestamp", startToday),
    ]);
    const schedRows = sched.data ?? [];
    const logsBySched = new Map((logs.data ?? []).map((l: any) => [l.schedule_id, l]));

    const active_classes = schedRows.filter((s: any) => ["ACTIVE", "LIVE"].includes(s.status)).length;
    const completed_today = schedRows.filter((s: any) => s.status === "ENDED").length;
    const missing_attendance = schedRows.filter((s: any) => {
      const log = logsBySched.get(s.id);
      return s.status === "ENDED" && (!log || log.session_status !== "COMPLETED");
    }).length;
    const late_attendance = schedRows.filter((s: any) => {
      if (!s.checkin_at || !s.start_time) return false;
      const start = new Date(`${today}T${s.start_time}`).getTime();
      return new Date(s.checkin_at).getTime() - start > 15 * 60_000;
    }).length;
    const schedule_submissions_today = (logs.data ?? []).length;

    return {
      active_classes,
      completed_today,
      missing_attendance,
      late_attendance,
      schedule_submissions_today,
      attendance_records_today: (atts.data ?? []).length,
    };
  });

/** Real critical-alert rows (no placeholders). */
export const listCriticalAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = todayDate();
    const startToday = startOfTodayISO();

    const [overdue, conflicts, pending, leaves] = await Promise.all([
      // Sessions that ended without a completed log
      supabase.from("schedules").select("id, module_code, end_time, status").eq("date", today)
        .in("status", ["LIVE", "ACTIVE"])
        .lt("end_time", new Date().toTimeString().slice(0, 8)),
      supabase.from("approval_queue")
        .select("schedule_id, conflict_trainer, conflict_venue, invalid_qualification, excessive_load")
        .eq("decision", "pending")
        .or("conflict_trainer.eq.true,conflict_venue.eq.true,invalid_qualification.eq.true,excessive_load.eq.true"),
      supabase.from("approval_queue").select("id", { count: "exact", head: true }).eq("decision", "pending"),
      supabase.from("leave_requests").select("id", { count: "exact", head: true })
        .eq("status", "PENDING").gte("start_date", today),
    ]);

    const alerts: { id: string; severity: "warning" | "critical"; title: string; detail?: string; count?: number; to?: string }[] = [];
    if ((overdue.data ?? []).length) {
      alerts.push({
        id: "missing-att",
        severity: "critical",
        title: "Sessions overdue without close-out",
        detail: "Trainers ended class but no completed session log",
        count: (overdue.data ?? []).length,
        to: "/strategic/audit",
      });
    }
    if ((conflicts.data ?? []).length) {
      alerts.push({
        id: "conflicts",
        severity: "critical",
        title: "Schedule conflicts on pending requests",
        detail: "Trainer / venue / qualification / load flags",
        count: (conflicts.data ?? []).length,
        to: "/strategic/approvals",
      });
    }
    if ((pending.count ?? 0) > 0) {
      alerts.push({
        id: "pending",
        severity: "warning",
        title: "Unapproved schedule requests",
        detail: "Awaiting MA decision",
        count: pending.count ?? 0,
        to: "/strategic/approvals",
      });
    }
    if ((leaves.count ?? 0) > 0) {
      alerts.push({
        id: "leaves",
        severity: "warning",
        title: "Pending trainer leave requests",
        detail: "Department heads awaiting decision",
        count: leaves.count ?? 0,
        to: "/strategic/audit",
      });
    }
    return alerts;
  });

/** Per-department performance rollup. */
export const getDepartmentPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const sevenDaysAgo = daysAgoISO(7);
    const [depts, scheds, atts] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("schedules")
        .select("id, department_id, status, checkin_at, start_time, date")
        .gte("date", daysAgoISO(7).slice(0, 10)),
      supabase.from("attendance_logs")
        .select("present, schedule_id, attendance_timestamp")
        .gte("attendance_timestamp", sevenDaysAgo),
    ]);

    const schedById = new Map<string, any>((scheds.data ?? []).map((s: any) => [s.id, s]));
    const attByDept = new Map<string, { total: number; present: number }>();
    for (const a of atts.data ?? []) {
      const s = schedById.get(a.schedule_id);
      if (!s) continue;
      const bucket = attByDept.get(s.department_id) ?? { total: 0, present: 0 };
      bucket.total++;
      if (a.present) bucket.present++;
      attByDept.set(s.department_id, bucket);
    }
    const schedByDept = new Map<string, any[]>();
    for (const s of scheds.data ?? []) {
      const arr = schedByDept.get(s.department_id) ?? [];
      arr.push(s);
      schedByDept.set(s.department_id, arr);
    }

    return (depts.data ?? []).map((d: any) => {
      const att = attByDept.get(d.id) ?? { total: 0, present: 0 };
      const all = schedByDept.get(d.id) ?? [];
      const ended = all.filter((s) => s.status === "ENDED").length;
      const completion = all.length ? Math.round((ended / all.length) * 100) : 0;
      const withCheckin = all.filter((s) => s.checkin_at && s.start_time);
      const punctual = withCheckin.filter((s) => {
        const start = new Date(`${s.date}T${s.start_time}`).getTime();
        return new Date(s.checkin_at).getTime() - start <= 15 * 60_000;
      }).length;
      const punctuality = withCheckin.length ? Math.round((punctual / withCheckin.length) * 100) : 0;
      const attendance = att.total ? Math.round((att.present / att.total) * 100) : 0;
      const submission = all.length ? Math.round((all.filter((s) => ["LIVE", "ACTIVE", "ENDED"].includes(s.status)).length / all.length) * 100) : 0;
      return {
        id: d.id,
        name: d.name,
        attendance,
        punctuality,
        completion,
        submission,
        sessions_total: all.length,
      };
    });
  });

/** Weekly approval series — last 8 ISO weeks. */
export const getWeeklyApprovalSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const from = daysAgoISO(8 * 7);
    const { data, error } = await context.supabase
      .from("approval_queue")
      .select("decision, created_at, decided_at")
      .gte("created_at", from);
    if (error) throw new Error(error.message);

    const buckets = new Map<string, { week: string; submitted: number; approved: number; rejected: number; pending: number }>();
    for (const r of data ?? []) {
      const key = isoWeekKey(new Date(r.created_at));
      const b = buckets.get(key) ?? { week: key, submitted: 0, approved: 0, rejected: 0, pending: 0 };
      b.submitted++;
      if (r.decision === "approved") b.approved++;
      else if (r.decision === "rejected") b.rejected++;
      else b.pending++;
      buckets.set(key, b);
    }
    return Array.from(buckets.values()).sort((a, b) => a.week.localeCompare(b.week));
  });

/** Unified live activity feed (audit + recent session/attendance). */
export const listLiveActivityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [audit, sessions, attendance] = await Promise.all([
      supabase.from("audit_logs")
        .select("id, action_type, entity_type, entity_id, timestamp")
        .order("timestamp", { ascending: false }).limit(15),
      supabase.from("session_logs")
        .select("id, schedule_id, session_status, submitted_at, geo_verified")
        .order("submitted_at", { ascending: false }).limit(8),
      supabase.from("attendance_overrides")
        .select("id, audit_comment, override_timestamp, new_value, old_value")
        .order("override_timestamp", { ascending: false }).limit(5),
    ]);
    const items: Array<{ id: string; action: string; entity?: string; detail?: string; timestamp: string; to?: string }> = [];
    for (const a of audit.data ?? []) {
      items.push({
        id: `a-${a.id}`,
        action: a.action_type,
        entity: a.entity_type,
        timestamp: a.timestamp,
        to: "/strategic/audit",
      });
    }
    for (const s of sessions.data ?? []) {
      items.push({
        id: `s-${s.id}`,
        action: s.session_status === "COMPLETED" ? "SUBMITTED" : "SESSION",
        entity: "session_logs",
        detail: s.geo_verified ? "geo-verified" : "geo-unverified",
        timestamp: s.submitted_at ?? new Date().toISOString(),
      });
    }
    for (const o of attendance.data ?? []) {
      items.push({
        id: `o-${o.id}`,
        action: "OVERRIDE",
        entity: "attendance",
        detail: o.audit_comment,
        timestamp: o.override_timestamp,
      });
    }
    return items
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, 20);
  });

// ============================================================================
//                       DEPARTMENT HEAD DASHBOARD
// ============================================================================

async function deptIdForUser(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle();
  return data?.department_id ?? null;
}

/** Extended DH KPIs scoped to the DH's department. */
export const getDHStatsExt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    const today = todayDate();
    const startToday = startOfTodayISO();
    const sevenDaysAgo = daysAgoISO(7);
    if (!deptId) {
      return {
        active_today: 0, attendance_pct: 0, pending_reviews: 0,
        submitted_attendance: 0, missing_attendance: 0, weekly_compliance: 0,
        updated_at: nowIso(),
      };
    }

    const [todayScheds, atts, pending, sevenDayScheds] = await Promise.all([
      supabase.from("schedules").select("id, status, checkin_at, start_time").eq("date", today).eq("department_id", deptId),
      supabase.from("attendance_logs")
        .select("present, schedule_id, attendance_timestamp")
        .gte("attendance_timestamp", startToday),
      supabase.from("approval_queue")
        .select("id, schedule_id")
        .eq("decision", "pending"),
      supabase.from("schedules").select("id, status, date").gte("date", sevenDaysAgo.slice(0, 10)).eq("department_id", deptId),
    ]);

    const todayRows = todayScheds.data ?? [];
    const activeToday = todayRows.filter((s: any) => ["ACTIVE", "LIVE"].includes(s.status)).length;
    const submittedCount = todayRows.filter((s: any) => s.status === "ENDED").length;
    const missingCount = todayRows.filter((s: any) => s.status === "ENDED").length === 0 ? 0 :
      todayRows.filter((s: any) => s.status === "ENDED" && !(atts.data ?? []).some((a: any) => a.schedule_id === s.id)).length;

    const myIds = new Set(todayRows.map((s: any) => s.id));
    const myAtts = (atts.data ?? []).filter((a: any) => myIds.has(a.schedule_id));
    const attendancePct = myAtts.length
      ? Math.round((myAtts.filter((a: any) => a.present).length / myAtts.length) * 100)
      : 0;

    // Pending reviews = pending approval rows whose schedule belongs to this dept
    const pendingIds = (pending.data ?? []).map((p: any) => p.schedule_id).filter(Boolean);
    let pendingReviews = 0;
    if (pendingIds.length) {
      const { count } = await supabase.from("schedules").select("*", { count: "exact", head: true })
        .in("id", pendingIds).eq("department_id", deptId);
      pendingReviews = count ?? 0;
    }

    const weekScheds = sevenDayScheds.data ?? [];
    const weeklyCompliance = weekScheds.length
      ? Math.round((weekScheds.filter((s: any) => ["LIVE", "ACTIVE", "ENDED"].includes(s.status)).length / weekScheds.length) * 100)
      : 0;

    return {
      active_today: activeToday,
      attendance_pct: attendancePct,
      pending_reviews: pendingReviews,
      submitted_attendance: submittedCount,
      missing_attendance: missingCount,
      weekly_compliance: weeklyCompliance,
      department_id: deptId,
      updated_at: nowIso(),
    };
  });

/** Schedule command center rows for current week. */
export const listDHScheduleCommand = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    if (!deptId) return [];
    const from = daysAgoISO(0).slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("schedules")
      .select("id, date, day, week_num, start_time, end_time, module_code, module_name, trainer_name, status, section_id")
      .eq("department_id", deptId)
      .gte("date", from).lte("date", to)
      .order("date").order("start_time")
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((d: any) => d.id);
    let attMap = new Map<string, number>();
    if (ids.length) {
      const { data: atts } = await supabase.from("attendance_logs").select("schedule_id, present").in("schedule_id", ids);
      for (const a of atts ?? []) {
        attMap.set(a.schedule_id, (attMap.get(a.schedule_id) ?? 0) + 1);
      }
    }
    return (data ?? []).map((s: any) => ({ ...s, attendance_count: attMap.get(s.id) ?? 0 }));
  });

/** Active classes RIGHT NOW for the DH's dept. */
export const listDHActiveClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    if (!deptId) return [];
    const today = todayDate();
    const { data, error } = await supabase
      .from("schedules")
      .select("id, module_code, module_name, trainer_name, start_time, end_time, status, checkin_at, date")
      .eq("department_id", deptId).eq("date", today)
      .in("status", ["LIVE", "ACTIVE"])
      .order("start_time");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Attendance monitor buckets for today. */
export const listDHAttendanceMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    if (!deptId) return { submitted: 0, missing: 0, late: 0, rows: [] };
    const today = todayDate();
    const { data: scheds } = await supabase.from("schedules")
      .select("id, status, checkin_at, start_time, module_code, trainer_name")
      .eq("department_id", deptId).eq("date", today);
    const { data: atts } = await supabase.from("attendance_logs")
      .select("schedule_id")
      .gte("attendance_timestamp", startOfTodayISO());
    const submittedIds = new Set((atts ?? []).map((a: any) => a.schedule_id));
    const ended = (scheds ?? []).filter((s: any) => s.status === "ENDED");
    const submitted = ended.filter((s: any) => submittedIds.has(s.id)).length;
    const missing = ended.filter((s: any) => !submittedIds.has(s.id)).length;
    const late = (scheds ?? []).filter((s: any) => {
      if (!s.checkin_at || !s.start_time) return false;
      const start = new Date(`${today}T${s.start_time}`).getTime();
      return new Date(s.checkin_at).getTime() - start > 15 * 60_000;
    }).length;
    return {
      submitted, missing, late,
      rows: (scheds ?? []).slice(0, 8).map((s: any) => ({
        id: s.id, module_code: s.module_code, trainer_name: s.trainer_name,
        start_time: s.start_time, status: s.status,
        submitted: submittedIds.has(s.id),
      })),
    };
  });

/** Trend analytics for DH dept — last 8 weeks. */
export const getDHAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    if (!deptId) return [];
    const from = daysAgoISO(8 * 7);
    const { data: scheds } = await supabase.from("schedules")
      .select("id, status, date, checkin_at, start_time")
      .eq("department_id", deptId).gte("date", from.slice(0, 10));
    const ids = (scheds ?? []).map((s: any) => s.id);
    const { data: atts } = ids.length
      ? await supabase.from("attendance_logs").select("schedule_id, present").in("schedule_id", ids)
      : { data: [] as any[] };

    const buckets = new Map<string, any>();
    for (const s of scheds ?? []) {
      const key = isoWeekKey(new Date(s.date));
      const b = buckets.get(key) ?? {
        week: key, total: 0, completed: 0, punctual: 0, withCheckin: 0,
      };
      b.total++;
      if (s.status === "ENDED") b.completed++;
      if (s.checkin_at && s.start_time) {
        b.withCheckin++;
        const start = new Date(`${s.date}T${s.start_time}`).getTime();
        if (new Date(s.checkin_at).getTime() - start <= 15 * 60_000) b.punctual++;
      }
      buckets.set(key, b);
    }
    const schedToWeek = new Map<string, string>();
    for (const s of scheds ?? []) schedToWeek.set(s.id, isoWeekKey(new Date(s.date)));
    const attByWeek = new Map<string, { total: number; present: number }>();
    for (const a of atts ?? []) {
      const k = schedToWeek.get(a.schedule_id);
      if (!k) continue;
      const bb = attByWeek.get(k) ?? { total: 0, present: 0 };
      bb.total++;
      if (a.present) bb.present++;
      attByWeek.set(k, bb);
    }
    return Array.from(buckets.values()).sort((a, b) => a.week.localeCompare(b.week)).map((b: any) => {
      const a = attByWeek.get(b.week) ?? { total: 0, present: 0 };
      return {
        week: b.week,
        attendance: a.total ? Math.round((a.present / a.total) * 100) : 0,
        punctuality: b.withCheckin ? Math.round((b.punctual / b.withCheckin) * 100) : 0,
        completion: b.total ? Math.round((b.completed / b.total) * 100) : 0,
      };
    });
  });

/** DH alerts. */
export const listDHAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const deptId = await deptIdForUser(supabase, userId);
    if (!deptId) return [];
    const today = todayDate();
    const startToday = startOfTodayISO();

    const [drafts, pending, conflicts, todayScheds, atts] = await Promise.all([
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("department_id", deptId).eq("status", "DRAFT"),
      supabase.from("schedules").select("id", { count: "exact", head: true }).eq("department_id", deptId).eq("status", "PENDING_MA"),
      supabase.from("approval_queue").select("id", { count: "exact", head: true })
        .eq("decision", "pending")
        .or("conflict_trainer.eq.true,conflict_venue.eq.true,invalid_qualification.eq.true,excessive_load.eq.true"),
      supabase.from("schedules").select("id, status, checkin_at, start_time").eq("department_id", deptId).eq("date", today),
      supabase.from("attendance_logs").select("schedule_id").gte("attendance_timestamp", startToday),
    ]);

    const submittedIds = new Set((atts.data ?? []).map((a: any) => a.schedule_id));
    const ended = (todayScheds.data ?? []).filter((s: any) => s.status === "ENDED");
    const missing = ended.filter((s: any) => !submittedIds.has(s.id)).length;
    const late = (todayScheds.data ?? []).filter((s: any) => {
      if (!s.checkin_at || !s.start_time) return false;
      const start = new Date(`${today}T${s.start_time}`).getTime();
      return new Date(s.checkin_at).getTime() - start > 15 * 60_000;
    }).length;

    const alerts: { id: string; severity: "warning" | "critical"; title: string; detail?: string; count: number; to?: string }[] = [];
    if (missing > 0) alerts.push({ id: "miss", severity: "critical", title: "Missing attendance today", detail: "Sessions ended without attendance log", count: missing, to: "/operational/attendance" });
    if (late > 0) alerts.push({ id: "late", severity: "warning", title: "Late trainer check-ins", detail: ">15min after start", count: late, to: "/operational/live-monitor" });
    if ((conflicts.data ?? []).length) alerts.push({ id: "conf", severity: "critical", title: "Schedule conflicts pending", detail: "Trainer / venue / qualification flags", count: (conflicts.data ?? []).length, to: "/operational/drafts" });
    if ((drafts.count ?? 0) > 0) alerts.push({ id: "draft", severity: "warning", title: "Unreviewed draft sessions", detail: "Awaiting your submission", count: drafts.count ?? 0, to: "/operational/drafts" });
    if ((pending.count ?? 0) > 0) alerts.push({ id: "pend", severity: "info" as any, title: "Awaiting Master Admin", detail: "Submitted, pending approval", count: pending.count ?? 0, to: "/operational/drafts" });
    return alerts;
  });