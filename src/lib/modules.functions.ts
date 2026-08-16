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

/** Create a single module from master-data ids (no name matching, no duplicates). */
export const createModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string().trim().min(1).max(40),
      name: z.string().trim().min(1).max(200),
      department_id: z.string().uuid(),
      level_id: z.string().uuid(),
      type: z.enum(["Theory", "Practical", "Both"]),
      qualifications: z.array(z.string().min(1).max(60)).default([]),
      total_hours: z.number().min(0).max(10000).default(0),
      total_sessions: z.number().int().min(0).max(10000).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("modules").insert(data).select().single();
    if (error) {
      if (error.code === "23505") throw new Error(`Module code '${data.code}' already exists.`);
      throw new Error(error.message);
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId, action_type: "CREATE", entity_type: "modules",
      entity_id: row.id, after_state: row,
    });
    return row;
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
    const errors: { row: number; column: string; value: string; reason: string }[] = [];
    const deptNames = (depts ?? []).map((d) => d.name).join(", ") || "none defined";
    type ModuleInsert = {
      code: string; name: string; department_id: string; level_id: string;
      type: "Theory" | "Practical" | "Both"; qualifications: string[];
      total_hours: number; total_sessions: number;
    };
    const payload: ModuleInsert[] = [];
    data.rows.forEach((r, idx) => {
      const dept_id = dMap.get(r.department_name.toLowerCase());
      if (!dept_id) {
        errors.push({
          row: idx + 1, column: "department_name", value: r.department_name,
          reason: `No department named "${r.department_name}". Use one of: ${deptNames} — or create it first under Departments.`,
        });
        return;
      }
      const level_id = lMap.get(`${dept_id}::${r.level_name}`);
      if (!level_id) {
        const options = (levels ?? []).filter((l) => l.department_id === dept_id).map((l) => l.name).join(", ") || "none defined";
        errors.push({
          row: idx + 1, column: "level_name", value: r.level_name,
          reason: `"${r.department_name}" has no level named "${r.level_name}". Use one of: ${options}.`,
        });
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
      if (error) {
        if (error.code === "23505") {
          const dup = /Key \(code\)=\(([^)]*)\)/.exec(`${error.message} ${error.details ?? ""}`)?.[1];
          throw new Error(
            dup
              ? `Module code '${dup}' already exists in the registry, so nothing was imported. Remove that row (or change the code) and upload again.`
              : "One of the module codes in this file already exists in the registry, so nothing was imported. Remove the duplicate row and upload again.",
          );
        }
        throw new Error(error.message);
      }
      inserted = ins?.length ?? 0;
    }
    errors.sort((a, b) => a.row - b.row);
    await supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "BULK_IMPORT", entity_type: "modules",
      after_state: { inserted, errors: errors.length },
    });
    return { inserted, errors };
  });