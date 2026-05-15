import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===== Current user role + profile =====
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      roles: (roles ?? []).map((r) => r.role as "MA" | "DH" | "T"),
    };
  });

// ===== Dashboard counts =====
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [d, t, s, sc] = await Promise.all([
      supabase.from("departments").select("*", { count: "exact", head: true }),
      supabase.from("trainer_registry").select("*", { count: "exact", head: true }),
      supabase.from("students").select("*", { count: "exact", head: true }),
      supabase.from("schedules").select("*", { count: "exact", head: true }),
    ]);
    return {
      departments: d.count ?? 0,
      trainers: t.count ?? 0,
      students: s.count ?? 0,
      schedules: sc.count ?? 0,
    };
  });

// ===== Departments CRUD =====
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const departmentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => departmentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      name: data.name,
      description: data.description ?? null,
      status: data.status,
    };
    let result;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("departments").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      result = row;
    } else {
      const { data: row, error } = await supabase
        .from("departments").insert(payload).select().single();
      if (error) throw new Error(error.message);
      result = row;
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: data.id ? "UPDATE" : "CREATE",
      entity_type: "departments",
      entity_id: result.id,
      after_state: result,
    });
    return result;
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "DELETE",
      entity_type: "departments",
      entity_id: data.id,
    });
    return { ok: true };
  });