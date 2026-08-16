import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEtPhone } from "@/lib/phone";
import { requireRole } from "@/lib/auth/require-role";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
        ? context.supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; email: string; phone: string | null }[] }),
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
      phone: pMap[h.user_id]?.phone ?? null,
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
      password: z.string().min(6).max(72),
      phone: z
        .string()
        .trim()
        .min(1, "Department Head telephone number is required.")
        .max(40)
        .refine((v) => normalizeEtPhone(v) !== null, {
          message: "Please enter a valid Ethiopian telephone number.",
        })
        .transform((v) => normalizeEtPhone(v) as string),
      avatar_path: z.string().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "dh.functions");
    const tempPassword = data.password;
    const { assertPhoneAvailable } = await import("@/lib/phone-uniqueness.server");
    await assertPhoneAvailable(data.phone);
    let staffCode = data.staff_code?.trim() ?? "";
    if (!staffCode) {
      const { data: gen } = await context.supabase.rpc("next_entity_code", {
        _department_id: data.department_id,
        _kind: "trainer",
      });
      staffCode = (gen as string) ?? "";
    }
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const newId = created.user.id;
    // Move pending avatar into the new user's folder
    let finalAvatar = data.avatar_path;
    if (data.avatar_path.startsWith("pending/")) {
      const ext = data.avatar_path.split(".").pop() || "jpg";
      finalAvatar = `${newId}/avatar-${Date.now()}.${ext}`;
      const { error: mvErr } = await supabaseAdmin.storage.from("avatars").move(data.avatar_path, finalAvatar);
      if (mvErr) throw new Error(mvErr.message);
    }
    await supabaseAdmin.from("profiles").upsert({
      id: newId, full_name: data.full_name, email: data.email, phone: data.phone,
      department_id: data.department_id, avatar_path: finalAvatar,
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

// ===== Trainers =====
export const listTrainers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: trainers, error } = await context.supabase
      .from("trainer_registry")
      .select("id, full_name, email, phone, department_id, qualifications, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const deptIds = Array.from(new Set((trainers ?? []).map((t) => t.department_id)));
    const { data: depts } = deptIds.length
      ? await context.supabase.from("departments").select("id, name").in("id", deptIds)
      : { data: [] as { id: string; name: string }[] };
    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]));
    return (trainers ?? []).map((t) => ({ ...t, department_name: dMap[t.department_id] ?? "—" }));
  });

export const createTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      full_name: z.string().min(1).max(120),
      department_id: z.string().uuid(),
      password: z.string().min(6).max(72),
      phone: z
        .string()
        .trim()
        .min(1, "Trainer telephone number is required.")
        .max(40)
        .refine((v) => normalizeEtPhone(v) !== null, {
          message: "Please enter a valid Ethiopian telephone number.",
        })
        .transform((v) => normalizeEtPhone(v) as string),
      qualifications: z.array(z.string().min(1).max(60)).default([]),
      avatar_path: z.string().min(1).max(300),
      staff_code: z.string().trim().max(40).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "dh.functions");
    const { assertPhoneAvailable } = await import("@/lib/phone-uniqueness.server");
    await assertPhoneAvailable(data.phone);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const newId = created.user.id;
    let finalAvatar = data.avatar_path;
    if (data.avatar_path.startsWith("pending/")) {
      const ext = data.avatar_path.split(".").pop() || "jpg";
      finalAvatar = `${newId}/avatar-${Date.now()}.${ext}`;
      const { error: mvErr } = await supabaseAdmin.storage.from("avatars").move(data.avatar_path, finalAvatar);
      if (mvErr) throw new Error(mvErr.message);
    }
    const { data: tr, error: trErr } = await supabaseAdmin.from("trainer_registry")
      .insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone ?? null,
        department_id: data.department_id,
        qualifications: data.qualifications,
        staff_code: staffCode || null,
      }).select().single();
    if (trErr) throw new Error(trErr.message);
    await supabaseAdmin.from("profiles").upsert({
      id: newId, full_name: data.full_name, email: data.email,
      phone: data.phone, department_id: data.department_id,
      trainer_registry_id: tr.id, avatar_path: finalAvatar,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "T" });
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "CREATE", entity_type: "trainer_registry", entity_id: tr.id,
      after_state: { user_id: newId, department_id: data.department_id, email: data.email },
    });
    return { ok: true, temp_password: data.password, email: data.email };
  });

export const revokeTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "dh.functions");
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("id").eq("trainer_registry_id", data.id).maybeSingle();
    await supabaseAdmin.from("trainer_registry").update({ status: "SUSPENDED" }).eq("id", data.id);
    if (profile?.id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", profile.id).eq("role", "T");
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "REVOKE", entity_type: "trainer_registry", entity_id: data.id,
    });
    return { ok: true };
  });

export const updateTrainerQualifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      qualifications: z.array(z.string().min(1).max(80)).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "dh.functions");
    const cleaned = Array.from(new Set(data.qualifications.map((q) => q.trim()).filter(Boolean)));
    const { data: before } = await context.supabase
      .from("trainer_registry").select("qualifications").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase
      .from("trainer_registry").update({ qualifications: cleaned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "UPDATE_QUALIFICATIONS",
      entity_type: "trainer_registry", entity_id: data.id,
      before_state: { qualifications: before?.qualifications ?? [] },
      after_state: { qualifications: cleaned },
    });
    return { ok: true, qualifications: cleaned };
  });