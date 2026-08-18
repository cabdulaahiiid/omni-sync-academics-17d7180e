import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

/** Full occupational curriculum tree (occupation -> module -> UC -> task). */
export const getCtCurriculum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [occupations, modules, ucs, tasks, settings] = await Promise.all([
      supabase.from("ct_occupations").select("id, code, name, department_id, active").order("name"),
      supabase
        .from("ct_training_modules")
        .select("id, occupation_id, level_id, code, name, sequence, active")
        .order("sequence"),
      supabase
        .from("ct_units_of_competence")
        .select("id, training_module_id, code, name, sequence, active")
        .order("sequence"),
      supabase.from("ct_training_tasks").select("id, uc_id, name, sequence, active").order("sequence"),
      supabase.from("ct_settings").select("*").limit(1).maybeSingle(),
    ]);
    return {
      occupations: occupations.data ?? [],
      modules: modules.data ?? [],
      ucs: ucs.data ?? [],
      tasks: tasks.data ?? [],
      settings: settings.data ?? null,
    };
  });

const occupationSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(150),
  department_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export const saveCtOccupation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => occupationSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtOccupation");
    const { id, ...values } = data;
    const q = id
      ? context.supabase.from("ct_occupations").update({ ...values, updated_by: context.userId }).eq("id", id)
      : context.supabase.from("ct_occupations").insert({ ...values, created_by: context.userId });
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const nodeSchema = z.object({
  kind: z.enum(["module", "uc", "task"]),
  id: z.string().uuid().optional(),
  parent_id: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().max(30).optional().nullable(),
  sequence: z.number().int().min(1).max(999).default(1),
  active: z.boolean().default(true),
});

/** Create or update a curriculum node (module / unit of competence / task). */
export const saveCtCurriculumNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => nodeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtCurriculumNode");
    const { supabase, userId } = context;
    if (data.kind === "module") {
      const row = {
        occupation_id: data.parent_id,
        name: data.name,
        code: data.code ?? null,
        sequence: data.sequence,
        active: data.active,
      };
      const { error } = data.id
        ? await supabase.from("ct_training_modules").update({ ...row, updated_by: userId }).eq("id", data.id)
        : await supabase.from("ct_training_modules").insert({ ...row, created_by: userId });
      if (error) throw new Error(error.message);
    } else if (data.kind === "uc") {
      const row = {
        training_module_id: data.parent_id,
        name: data.name,
        code: data.code ?? null,
        sequence: data.sequence,
        active: data.active,
      };
      const { error } = data.id
        ? await supabase.from("ct_units_of_competence").update({ ...row, updated_by: userId }).eq("id", data.id)
        : await supabase.from("ct_units_of_competence").insert({ ...row, created_by: userId });
      if (error) throw new Error(error.message);
    } else {
      const row = { uc_id: data.parent_id, name: data.name, sequence: data.sequence, active: data.active };
      const { error } = data.id
        ? await supabase.from("ct_training_tasks").update({ ...row, updated_by: userId }).eq("id", data.id)
        : await supabase.from("ct_training_tasks").insert({ ...row, created_by: userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const settingsSchema = z.object({
  theory_threshold_percent: z.number().min(0).max(100),
  max_daily_logbook_hours: z.number().min(1).max(24),
  remedial_hours_per_failed_uc: z.number().int().min(0).max(500),
  remedial_hours_per_red_competency: z.number().int().min(0).max(500),
  max_red_competencies_for_assessment: z.number().int().min(0).max(7),
  absence_days_threshold: z.number().int().min(1).max(30),
});

export const saveCtSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "saveCtSettings");
    const { data: row } = await context.supabase.from("ct_settings").select("id").limit(1).maybeSingle();
    if (!row) throw new Error("Settings row is missing.");
    const { error } = await context.supabase
      .from("ct_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
