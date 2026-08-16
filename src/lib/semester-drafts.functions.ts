import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSemesterDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { requireRole } = await import("@/lib/auth/require-role");
    const roles = await requireRole(context, ["DH", "MA"], "listSemesterDrafts");

    let departmentId = data.department_id ?? null;
    if (!roles.includes("MA")) {
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", context.userId)
        .maybeSingle();
      if (profError) throw new Error(profError.message);
      departmentId = prof?.department_id ?? null;
      if (!departmentId) throw new Error("No department assigned to this Department Head account.");
    }

    const { data: sems, error } = await supabase
      .from("semester_registry")
      .select("id, name, start_date, end_date, status, distribution_status")
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (sems ?? []).map((s) => s.id);
    if (!ids.length) return [];
    let scheduleQuery = supabase
      .from("schedules")
      .select("semester_id, week_num, status, is_published")
      .in("semester_id", ids)
      .neq("status", "CANCELLED");
    if (departmentId) scheduleQuery = scheduleQuery.eq("department_id", departmentId);
    const { data: rows, error: rowsError } = await scheduleQuery;
    if (rowsError) throw new Error(rowsError.message);

    const byId = new Map<string, Record<number, { total: number; draft: number; pending: number; published: number }>>();
    for (const r of rows ?? []) {
      if (!r.semester_id || r.week_num == null) continue;
      const m = byId.get(r.semester_id) ?? {};
      const w = m[r.week_num] ?? { total: 0, draft: 0, pending: 0, published: 0 };
      w.total += 1;
      if (r.status === "DRAFT" && !r.is_published) w.draft += 1;
      if (r.status === "PENDING_MA") w.pending += 1;
      if (r.is_published) w.published += 1;
      m[r.week_num] = w;
      byId.set(r.semester_id, m);
    }

    return (sems ?? [])
      .filter((s) => byId.has(s.id))
      .map((s) => {
        const weeks = byId.get(s.id) ?? {};
        const entries = Object.entries(weeks)
          .map(([k, v]) => ({ week_num: Number(k), ...v }))
          .sort((a, b) => a.week_num - b.week_num);
        return { ...s, weeks: entries };
      });
  });

export const requestSemesterApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // If semester is in FEEDBACK_ACTIVE, route through dh_resubmit_semester
    // (otherwise submit_for_approval silently no-ops because nothing is in DRAFT).
    const { data: sem } = await context.supabase
      .from("semester_registry")
      .select("distribution_status")
      .eq("id", data.semester_id)
      .maybeSingle();
    if (sem?.distribution_status === "FEEDBACK_ACTIVE") {
      const { error } = await context.supabase.rpc("dh_resubmit_semester", {
        _semester_id: data.semester_id,
      });
      if (error) throw new Error(error.message);
      return { count: 1, resubmitted: true };
    }
    const { data: count, error } = await context.supabase.rpc("submit_for_approval", {
      _type: "semester",
      _target_ids: [data.semester_id],
    });
    if (error) throw new Error(error.message);
    await context.supabase
      .from("semester_registry")
      .update({ distribution_status: "PENDING_MA" })
      .eq("id", data.semester_id);
    return { count, resubmitted: false };
  });

export const dhDeleteDraftSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ schedule_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dh_delete_draft_session", {
      _schedule_id: data.schedule_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDraftSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      patch: z.object({
        date: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        venue_id: z.string().uuid().optional(),
        trainer_registry_id: z.string().uuid().optional(),
        section_id: z.string().uuid().optional(),
        week_num: z.number().int().min(1).max(20).optional(),
        day: z.enum(["MON","TUE","WED","THU","FRI","SAT","SUN"]).optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: before } = await context.supabase
      .from("schedules")
      .select("id, date, start_time, end_time, venue_id, trainer_registry_id, section_id, week_num, day, status")
      .eq("id", data.schedule_id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("schedules")
      .update(data.patch)
      .eq("id", data.schedule_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "EDIT_DRAFT_SESSION",
      entity_type: "schedules",
      entity_id: data.schedule_id,
      before_state: (before ?? {}) as any,
      after_state: data.patch as any,
    });
    return { ok: true };
  });

export const listSemesterSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schedules")
      .select("id, date, week_num, day, start_time, end_time, module_code, module_name, trainer_name, trainer_registry_id, venue_id, status, is_published")
      .eq("semester_id", data.semester_id)
      .order("date")
      .order("start_time");
    if (error) throw new Error(error.message);
    const { data: sem } = await context.supabase
      .from("semester_registry")
      .select("id, name, status, distribution_status")
      .eq("id", data.semester_id)
      .maybeSingle();
    return { sessions: rows ?? [], semester: sem };
  });

export const getSemesterWeekTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid(),
      week_num: z.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("schedules")
      .select(
        "id, date, day, week_num, start_time, end_time, module_code, module_name, trainer_name, status, is_published, venue_id, section_id",
      )
      .eq("semester_id", data.semester_id)
      .eq("week_num", data.week_num)
      .order("date")
      .order("start_time");
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

export const dhRequestApprovalPerWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("dh_submit_semester_per_week", {
      _semester_id: data.semester_id,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as { created?: number };
    return { created: r.created ?? 0 };
  });

/**
 * Full Module representation of the SAME draft rows the weekly view uses.
 * No extra records: schedules are grouped by module + level + section so the
 * DH can review a module end-to-end instead of week by week.
 */
/**
 * Chronological session list for one canonical plan (or one legacy module
 * group) — the same rows the weekly view groups by week, nothing recalculated.
 */
export const listPlanSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ plan_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schedules")
      .select("id, session_number, week_num, date, day, start_time, end_time, status, is_published, module_code, module_name, trainer_name")
      .eq("plan_id", data.plan_id)
      .order("date")
      .order("start_time");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDraftModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { requireRole } = await import("@/lib/auth/require-role");
    const roles = await requireRole(context, ["DH", "MA"], "listDraftModules");

    let departmentId = data.department_id ?? null;
    if (!roles.includes("MA")) {
      const { data: prof } = await supabase
        .from("profiles").select("department_id").eq("id", context.userId).maybeSingle();
      departmentId = prof?.department_id ?? null;
      if (!departmentId) throw new Error("No department assigned to this Department Head account.");
    }

    let q = supabase
      .from("schedules")
      .select("id, semester_id, module_code, module_name, level_id, section_id, trainer_name, date, week_num, session_number, plan_id, start_time, end_time, status, is_published")
      .neq("status", "CANCELLED")
      .order("date")
      .order("start_time");
    if (departmentId) q = q.eq("department_id", departmentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];

    const [{ data: sems }, { data: levels }, { data: sections }] = await Promise.all([
      supabase.from("semester_registry").select("id, name, start_date, end_date, distribution_status"),
      supabase.from("levels").select("id, name, display_name"),
      supabase.from("sections").select("id, name"),
    ]);
    const semMap = new Map((sems ?? []).map((s: any) => [s.id, s]));
    const lvlMap = new Map((levels ?? []).map((l: any) => [l.id, l.display_name || `Level ${l.name}`]));
    const secMap = new Map((sections ?? []).map((s: any) => [s.id, s.name]));

    type Group = {
      key: string; plan_id: string | null; semester_id: string; semester_name: string;
      module_code: string; module_name: string; level_name: string; section_name: string;
      trainer_name: string; start_date: string; end_date: string;
      weeks: number[]; sessions: number; total_minutes: number;
      draft: number; pending: number; published: number;
      distribution_status: string | null;
    };
    const groups = new Map<string, Group>();
    for (const r of rows) {
      // A canonical plan is the group; legacy rows fall back to the old key.
      const key = r.plan_id ?? `${r.semester_id}|${r.module_code}|${r.level_id}|${r.section_id}`;
      const sem: any = semMap.get(r.semester_id);
      const g = groups.get(key) ?? {
        key,
        plan_id: r.plan_id ?? null,
        semester_id: r.semester_id,
        semester_name: sem?.name ?? "—",
        module_code: r.module_code,
        module_name: r.module_name,
        level_name: r.level_id ? lvlMap.get(r.level_id) ?? "—" : "—",
        section_name: r.section_id ? secMap.get(r.section_id) ?? "—" : "—",
        trainer_name: r.trainer_name,
        start_date: r.date, end_date: r.date,
        weeks: [] as number[], sessions: 0, total_minutes: 0,
        draft: 0, pending: 0, published: 0,
        distribution_status: sem?.distribution_status ?? null,
      };
      const [sh, sm] = String(r.start_time).split(":").map(Number);
      const [eh, em] = String(r.end_time).split(":").map(Number);
      g.total_minutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      g.sessions += 1;
      if (r.week_num != null && !g.weeks.includes(r.week_num)) g.weeks.push(r.week_num);
      if (r.date < g.start_date) g.start_date = r.date;
      if (r.date > g.end_date) g.end_date = r.date;
      if (r.status === "DRAFT" && !r.is_published) g.draft += 1;
      if (r.status === "PENDING_MA") g.pending += 1;
      if (r.is_published) g.published += 1;
      groups.set(key, g);
    }

    return Array.from(groups.values())
      .map((g) => ({ ...g, weeks: g.weeks.sort((a, b) => a - b) }))
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.module_code.localeCompare(b.module_code));
  });