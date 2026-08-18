import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

/** Department checklist + evaluation weights for the caller's department (admins see all). */
export const getCtDepartmentSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: departments }, { data: configs }, { data: competencies }] = await Promise.all([
      supabase.from("profiles").select("id, department_id").eq("id", userId).maybeSingle(),
      supabase.from("departments").select("id, name, code").order("name"),
      (supabase.from("ct_department_eval_configs" as any) as any).select("*"),
      (supabase.from("ct_department_competencies" as any) as any)
        .select("id, department_id, name, description, critical, sort_order, active")
        .order("sort_order"),
    ]);
    return {
      myDepartmentId: (profile as any)?.department_id ?? null,
      departments: (departments ?? []) as any[],
      configs: (configs ?? []) as any[],
      competencies: (competencies ?? []) as any[],
    };
  });

const configSchema = z.object({
  department_id: z.string().uuid(),
  weight_daily: z.coerce.number().min(0).max(100),
  weight_industry: z.coerce.number().min(0).max(100),
  weight_tvet: z.coerce.number().min(0).max(100),
  passing_threshold: z.coerce.number().min(0).max(100),
  attendance_threshold: z.coerce.number().min(0).max(100),
  max_allowed_gaps: z.coerce.number().int().min(0).max(50),
});

export const saveCtDepartmentConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => configSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtDepartmentConfig");
    const total = data.weight_daily + data.weight_industry + data.weight_tvet;
    if (Math.round(total) !== 100) {
      throw new Error(`The three weights must add up to 100 (currently ${total}).`);
    }
    const { data: id, error } = await (context.supabase.rpc as any)("ct_upsert_department_config", {
      _department_id: data.department_id,
      _weight_daily: data.weight_daily,
      _weight_industry: data.weight_industry,
      _weight_tvet: data.weight_tvet,
      _passing_threshold: data.passing_threshold,
      _attendance_threshold: data.attendance_threshold,
      _max_allowed_gaps: data.max_allowed_gaps,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

const competencySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid(),
  name: z.string().trim().min(2, "Give the competency a name").max(160),
  description: z.string().trim().max(500).optional().nullable(),
  critical: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const saveCtCompetency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => competencySchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtCompetency");
    const payload = {
      department_id: data.department_id,
      name: data.name,
      description: data.description ?? null,
      critical: data.critical,
      sort_order: data.sort_order,
      active: data.active,
      updated_by: context.userId,
    };
    const table = context.supabase.from("ct_department_competencies" as any) as any;
    const { error } = data.id
      ? await table.update(payload).eq("id", data.id)
      : await table.insert({ ...payload, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCtCompetency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "deleteCtCompetency");
    const { error } = await (context.supabase.from("ct_department_competencies" as any) as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
