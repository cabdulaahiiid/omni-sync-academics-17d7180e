import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Departments that currently have any pending session approvals. */
export const listDeptsWithPendingSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: depts, error: dErr } = await supabase
      .from("departments")
      .select("id, name, status")
      .order("name");
    if (dErr) throw new Error(dErr.message);

    const { data: pendingRows, error: aErr } = await supabase
      .from("approval_queue")
      .select("schedule_id")
      .eq("type", "session")
      .eq("decision", "pending");
    if (aErr) throw new Error(aErr.message);

    const schedIds = (pendingRows ?? []).map((r) => r.schedule_id).filter(Boolean) as string[];
    if (schedIds.length === 0) {
      return (depts ?? []).map((d) => ({ ...d, pending_count: 0 }));
    }
    const { data: scheds } = await supabase
      .from("schedules")
      .select("id, department_id")
      .in("id", schedIds);
    const counts = new Map<string, number>();
    for (const s of scheds ?? []) {
      counts.set(s.department_id, (counts.get(s.department_id) ?? 0) + 1);
    }
    return (depts ?? []).map((d) => ({ ...d, pending_count: counts.get(d.id) ?? 0 }));
  });

/** Weeks (week_num) that have pending session approvals for a given department. */
export const listPendingWeeksForDept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: scheds, error } = await supabase
      .from("schedules")
      .select("id, week_num, semester_id")
      .eq("department_id", data.department_id);
    if (error) throw new Error(error.message);
    const idByWeek = new Map<number, string[]>();
    for (const s of scheds ?? []) {
      const arr = idByWeek.get(s.week_num) ?? [];
      arr.push(s.id);
      idByWeek.set(s.week_num, arr);
    }
    const { data: pending, error: aErr } = await supabase
      .from("approval_queue")
      .select("schedule_id")
      .eq("type", "session")
      .eq("decision", "pending")
      .in("schedule_id", (scheds ?? []).map((s) => s.id));
    if (aErr) throw new Error(aErr.message);
    const pendingIds = new Set((pending ?? []).map((p) => p.schedule_id));
    const out: { week_num: number; pending: number; total: number }[] = [];
    for (const [week, ids] of idByWeek.entries()) {
      out.push({
        week_num: week,
        total: ids.length,
        pending: ids.filter((i) => pendingIds.has(i)).length,
      });
    }
    out.sort((a, b) => a.week_num - b.week_num);
    return out;
  });

/** Full timetable + approval rows for a (department, week). */
export const getWeekTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      department_id: z.string().uuid(),
      week_num: z.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: scheds, error } = await supabase
      .from("schedules")
      .select(
        "id, module_code, module_name, trainer_name, date, day, start_time, end_time, status, venue_id, section_id, level_id",
      )
      .eq("department_id", data.department_id)
      .eq("week_num", data.week_num)
      .order("date")
      .order("start_time");
    if (error) throw new Error(error.message);
    const ids = (scheds ?? []).map((s) => s.id);
    let approvals: Record<string, { id: string; decision: string }> = {};
    if (ids.length) {
      const { data: aq } = await supabase
        .from("approval_queue")
        .select("id, schedule_id, decision")
        .eq("type", "session")
        .in("schedule_id", ids);
      approvals = Object.fromEntries(
        (aq ?? []).map((a) => [a.schedule_id as string, { id: a.id, decision: a.decision }]),
      );
    }
    return (scheds ?? []).map((s) => ({
      ...s,
      approval: approvals[s.id] ?? null,
    }));
  });

/** Bulk decide for an entire week. */
export const decideWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      department_id: z.string().uuid(),
      week_num: z.number().int(),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().max(1000).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.decision === "rejected" && data.comment.trim().length < 3) {
      throw new Error("Feedback message required to send back a week");
    }
    const { data: result, error } = await context.supabase.rpc("ma_decide_week", {
      _department_id: data.department_id,
      _week_num: data.week_num,
      _decision: data.decision,
      _message: data.comment,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as { count?: number; thread_id?: string };
    return { count: r.count ?? 0, thread_id: r.thread_id ?? null };
  });

/** Department overview: levels, sections per level, trainers, modules completed/ongoing. */
export const getDepartmentOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const dept_id = data.department_id;
    const [
      { data: dept },
      { data: levels },
      { data: sections },
      { data: trainers },
      { data: modules },
      { data: scheds },
    ] = await Promise.all([
      supabase.from("departments").select("*").eq("id", dept_id).maybeSingle(),
      supabase.from("levels").select("id, name, display_name, status").eq("department_id", dept_id),
      supabase.from("sections").select("id, name, level_id").eq("department_id", dept_id),
      supabase
        .from("trainer_registry")
        .select("id, full_name, email, status, sessions_completed, sessions_target")
        .eq("department_id", dept_id)
        .order("full_name"),
      supabase
        .from("modules")
        .select("id, code, name, level_id, status, total_sessions")
        .eq("department_id", dept_id)
        .order("code"),
      supabase
        .from("schedules")
        .select("module_code, status")
        .eq("department_id", dept_id),
    ]);

    const sectionsByLevel: Record<string, { id: string; name: string }[]> = {};
    for (const s of sections ?? []) {
      (sectionsByLevel[s.level_id] ??= []).push({ id: s.id, name: s.name });
    }
    // Completed = module has at least one ENDED schedule. Ongoing = at least one LIVE/ACTIVE/PENDING_MA.
    const statusByCode = new Map<string, Set<string>>();
    for (const r of scheds ?? []) {
      const set = statusByCode.get(r.module_code) ?? new Set<string>();
      set.add(r.status);
      statusByCode.set(r.module_code, set);
    }
    let completed = 0;
    let ongoing = 0;
    for (const m of modules ?? []) {
      const set = statusByCode.get(m.code);
      if (!set) continue;
      if (set.has("ENDED") && !(set.has("LIVE") || set.has("ACTIVE") || set.has("PENDING_MA")))
        completed++;
      else if (set.has("LIVE") || set.has("ACTIVE") || set.has("PENDING_MA")) ongoing++;
    }
    return {
      department: dept,
      levels: levels ?? [],
      sectionsByLevel,
      trainers: trainers ?? [],
      modules: modules ?? [],
      moduleStats: { completed, ongoing, total: (modules ?? []).length },
    };
  });

/** Split a pending semester-level approval into per-session approvals (grouped by week). */
export const splitSemesterToWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ approval_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("ma_split_semester_to_weeks", {
      _approval_id: data.approval_id,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as { semester_id?: string; created?: number };
    return { semester_id: r.semester_id ?? null, created: r.created ?? 0 };
  });