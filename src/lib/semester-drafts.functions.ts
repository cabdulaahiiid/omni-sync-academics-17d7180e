import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSemesterDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sems, error } = await supabase
      .from("semester_registry")
      .select("id, name, start_date, end_date, status, distribution_status")
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (sems ?? []).map((s) => s.id);
    if (!ids.length) return [];
    const { data: rows } = await supabase
      .from("schedules")
      .select("semester_id, week_num, status, is_published")
      .eq("department_id", data.department_id)
      .in("semester_id", ids);

    const byId = new Map<string, Record<number, { total: number; pending: number; published: number }>>();
    for (const r of rows ?? []) {
      if (!r.semester_id || r.week_num == null) continue;
      const m = byId.get(r.semester_id) ?? {};
      const w = m[r.week_num] ?? { total: 0, pending: 0, published: 0 };
      w.total += 1;
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
    const { data: count, error } = await context.supabase.rpc("submit_for_approval", {
      _type: "semester",
      _target_ids: [data.semester_id],
    });
    if (error) throw new Error(error.message);
    await context.supabase
      .from("semester_registry")
      .update({ distribution_status: "PENDING_MA" })
      .eq("id", data.semester_id);
    return { count };
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
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("schedules")
      .update(data.patch)
      .eq("id", data.schedule_id);
    if (error) throw new Error(error.message);
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