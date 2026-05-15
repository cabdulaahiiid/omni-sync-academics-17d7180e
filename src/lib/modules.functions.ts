import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: modules, error }, { data: depts }, { data: levels }] = await Promise.all([
      context.supabase.from("modules").select("*").order("created_at", { ascending: false }),
      context.supabase.from("departments").select("id, name"),
      context.supabase.from("levels").select("id, name, department_id"),
    ]);
    if (error) throw new Error(error.message);
    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]));
    const lMap = Object.fromEntries((levels ?? []).map((l) => [l.id, l.name]));
    return (modules ?? []).map((m) => ({
      ...m,
      department_name: dMap[m.department_id] ?? "—",
      level_name: lMap[m.level_id] ?? "—",
    }));
  });

const moduleRow = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  department_name: z.string().min(1),
  level_name: z.string().min(1),
  type: z.enum(["Theory", "Practical", "Both"]).default("Both"),
  qualifications: z.array(z.string()).default([]),
  total_hours: z.number().min(0).default(0),
  total_sessions: z.number().int().min(0).default(0),
});

export const bulkInsertModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(moduleRow).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: depts } = await supabase.from("departments").select("id, name");
    const { data: levels } = await supabase.from("levels").select("id, name, department_id");
    const dMap = new Map((depts ?? []).map((d) => [d.name.toLowerCase(), d.id]));
    const lMap = new Map((levels ?? []).map((l) => [`${l.department_id}::${l.name}`, l.id]));
    const errors: { row: number; reason: string }[] = [];
    const payload: Record<string, unknown>[] = [];
    data.rows.forEach((r, idx) => {
      const dept_id = dMap.get(r.department_name.toLowerCase());
      if (!dept_id) {
        errors.push({ row: idx + 1, reason: `Unknown department '${r.department_name}'` });
        return;
      }
      const level_id = lMap.get(`${dept_id}::${r.level_name}`);
      if (!level_id) {
        errors.push({ row: idx + 1, reason: `Unknown level '${r.level_name}' in '${r.department_name}'` });
        return;
      }
      payload.push({
        code: r.code, name: r.name, department_id: dept_id, level_id,
        type: r.type, qualifications: r.qualifications,
        total_hours: r.total_hours, total_sessions: r.total_sessions,
      });
    });
    let inserted = 0;
    if (payload.length) {
      const { data: ins, error } = await supabase.from("modules").insert(payload).select("id");
      if (error) throw new Error(error.message);
      inserted = ins?.length ?? 0;
    }
    await supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "BULK_IMPORT", entity_type: "modules",
      after_state: { inserted, errors: errors.length },
    });
    return { inserted, errors };
  });