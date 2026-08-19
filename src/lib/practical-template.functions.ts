import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export const practicalTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  competency_code: z.string().trim().max(40).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean().default(true),
});

export const practicalSessionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  allocated_hours: z.number().min(0).max(2000).default(0),
  venue_hint: z.string().trim().max(120).optional().nullable(),
  active: z.boolean().default(true),
  tasks: z.array(practicalTaskSchema).max(50).default([]),
});

export type PracticalSessionInput = z.infer<typeof practicalSessionSchema>;

/** Master practical template attached to an academic module. */
export const getModulePracticalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ module_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sessions, error } = await supabase
      .from("module_practical_sessions")
      .select("id, name, allocated_hours, venue_hint, sequence, active")
      .eq("module_id", data.module_id)
      .order("sequence");
    if (error) throw new Error(error.message);
    const ids = (sessions ?? []).map((s) => s.id);
    const { data: tasks } = ids.length
      ? await supabase
          .from("module_practical_tasks")
          .select("id, session_id, title, competency_code, description, sequence, active")
          .in("session_id", ids)
          .order("sequence")
      : { data: [] as any[] };
    return {
      sessions: (sessions ?? []).map((s) => ({
        ...s,
        allocated_hours: Number(s.allocated_hours ?? 0),
        tasks: ((tasks as any[]) ?? []).filter((t) => t.session_id === s.id),
      })),
    };
  });

/**
 * Replace a module's practical template. Admin-only: this is the master pool
 * that Department Heads and the practical-training roles draw from.
 */
export const saveModulePracticalTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        module_id: z.string().uuid(),
        sessions: z.array(practicalSessionSchema).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "saveModulePracticalTemplate");
    const { supabase, userId } = context;

    const { error: delErr } = await supabase
      .from("module_practical_sessions")
      .delete()
      .eq("module_id", data.module_id);
    if (delErr) throw new Error(delErr.message);

    let sessions = 0;
    let tasks = 0;
    for (const [i, s] of data.sessions.entries()) {
      const { data: row, error } = await supabase
        .from("module_practical_sessions")
        .insert({
          module_id: data.module_id,
          name: s.name,
          allocated_hours: s.allocated_hours,
          venue_hint: s.venue_hint ?? null,
          sequence: i + 1,
          active: s.active,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sessions += 1;
      if (s.tasks.length) {
        const { error: tErr } = await supabase.from("module_practical_tasks").insert(
          s.tasks.map((t, j) => ({
            session_id: row.id,
            title: t.title,
            competency_code: t.competency_code ?? null,
            description: t.description ?? null,
            sequence: j + 1,
            active: t.active,
            created_by: userId,
            updated_by: userId,
          })),
        );
        if (tErr) throw new Error(tErr.message);
        tasks += s.tasks.length;
      }
    }

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: "UPDATE",
      entity_type: "module_practical_template",
      entity_id: data.module_id,
      after_state: { sessions, tasks } as any,
    });
    return { ok: true, sessions, tasks };
  });

/** Practical session/task tree stored with a saved schedule plan. */
export const getPlanPracticalTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sessions, error } = await supabase
      .from("schedule_plan_practical_sessions")
      .select("id, name, allocated_hours, venue_hint, sequence")
      .eq("plan_id", data.plan_id)
      .order("sequence");
    if (error) throw new Error(error.message);
    const ids = (sessions ?? []).map((s) => s.id);
    const { data: tasks } = ids.length
      ? await supabase
          .from("schedule_plan_practical_tasks")
          .select("id, session_id, title, competency_code, description, sequence")
          .in("session_id", ids)
          .order("sequence")
      : { data: [] as any[] };
    return {
      sessions: (sessions ?? []).map((s) => ({
        ...s,
        allocated_hours: Number(s.allocated_hours ?? 0),
        tasks: ((tasks as any[]) ?? []).filter((t) => t.session_id === s.id),
      })),
    };
  });
