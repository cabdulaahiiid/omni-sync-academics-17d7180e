import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function genTempPassword() {
  return Math.random().toString(36).slice(2, 10) + "A!" + Math.random().toString(36).slice(2, 6);
}

export const listDepartmentHeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: heads, error } = await context.supabase
      .from("department_heads")
      .select("id, user_id, department_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const userIds = (heads ?? []).map((h) => h.user_id);
    const deptIds = (heads ?? []).map((h) => h.department_id);
    const [{ data: profiles }, { data: depts }] = await Promise.all([
      userIds.length
        ? context.supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
      deptIds.length
        ? context.supabase.from("departments").select("id, name").in("id", deptIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const pMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d]));
    return (heads ?? []).map((h) => ({
      id: h.id,
      user_id: h.user_id,
      department_id: h.department_id,
      department_name: dMap[h.department_id]?.name ?? "—",
      full_name: pMap[h.user_id]?.full_name ?? "",
      email: pMap[h.user_id]?.email ?? "",
      created_at: h.created_at,
    }));
  });

export const createDepartmentHead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      full_name: z.string().min(1).max(120),
      department_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!context.claims?.app_metadata && !(await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "MA").maybeSingle()).data) {
      throw new Error("Forbidden");
    }
    const tempPassword = genTempPassword();
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const newId = created.user.id;
    // Insert role + profile + dh row using admin (bypasses RLS edge cases)
    await supabaseAdmin.from("profiles").upsert({
      id: newId, full_name: data.full_name, email: data.email, department_id: data.department_id,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "DH" });
    const { data: dh, error: dhErr } = await supabaseAdmin.from("department_heads")
      .insert({ user_id: newId, department_id: data.department_id }).select().single();
    if (dhErr) throw new Error(dhErr.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "CREATE",
      entity_type: "department_heads",
      entity_id: dh.id,
      after_state: { user_id: newId, department_id: data.department_id, email: data.email },
    });
    return { ok: true, temp_password: tempPassword, email: data.email };
  });

export const revokeDepartmentHead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("department_heads").select("user_id").eq("id", data.id).single();
    const { error } = await context.supabase.from("department_heads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "DH");
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "REVOKE", entity_type: "department_heads", entity_id: data.id,
    });
    return { ok: true };
  });