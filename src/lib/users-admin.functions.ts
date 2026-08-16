import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireRole } from "@/lib/auth/require-role";
import { normalizeEtPhone } from "@/lib/phone";

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "listAllUsers");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, department_id, trainer_registry_id, bypass_geofence, active, created_at, avatar_path")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const trIds = (profiles ?? []).map((p: any) => p.trainer_registry_id).filter(Boolean);
    const [{ data: roles }, { data: depts }, { data: trDepts }] = await Promise.all([
      ids.length ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin.from("departments").select("id, name"),
      trIds.length
        ? supabaseAdmin.from("trainer_departments").select("trainer_registry_id, department_id, is_primary").in("trainer_registry_id", trIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const roleMap: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (roleMap[r.user_id] = roleMap[r.user_id] ?? []).push(r.role as string);
    }
    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]));
    const trDeptMap: Record<string, { department_id: string; is_primary: boolean }[]> = {};
    for (const row of trDepts ?? []) {
      (trDeptMap[(row as any).trainer_registry_id] = trDeptMap[(row as any).trainer_registry_id] ?? []).push({
        department_id: (row as any).department_id, is_primary: (row as any).is_primary,
      });
    }
    const withAvatars = await Promise.all(
      (profiles ?? []).map(async (p) => {
        let avatar_url: string | null = null;
        if (p.avatar_path) {
          const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(p.avatar_path, 60 * 60);
          avatar_url = signed?.signedUrl ?? null;
        }
        const tDepts = (p as any).trainer_registry_id ? (trDeptMap[(p as any).trainer_registry_id] ?? []) : [];
        return {
          ...p,
          avatar_url,
          roles: roleMap[p.id] ?? [],
          department_name: p.department_id ? dMap[p.department_id] ?? "—" : "—",
          department_ids: tDepts.map((t) => t.department_id),
          primary_department_id: tDepts.find((t) => t.is_primary)?.department_id ?? p.department_id ?? null,
        };
      }),
    );
    return withAvatars;
  });

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      full_name: z.string().min(1).max(160),
      password: z.string().min(8).max(72),
      role: z.enum(["MA", "DH", "T"]),
      department_id: z.string().uuid().nullable().optional(),
      phone: z
        .string()
        .trim()
        .min(1, "Telephone number is required.")
        .max(40)
        .refine((v) => normalizeEtPhone(v) !== null, {
          message: "Please enter a valid Ethiopian telephone number.",
        })
        .transform((v) => normalizeEtPhone(v) as string),
      avatar_path: z.string().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "createUserAccount");
    const { assertPhoneAvailable } = await import("@/lib/phone-uniqueness.server");
    await assertPhoneAvailable(data.phone);
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Failed to create user");
    const uid = created.user.id;
    let finalAvatar = data.avatar_path;
    if (data.avatar_path.startsWith("pending/")) {
      const ext = data.avatar_path.split(".").pop() || "jpg";
      finalAvatar = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: mvErr } = await supabaseAdmin.storage.from("avatars").move(data.avatar_path, finalAvatar);
      if (mvErr) throw new Error(mvErr.message);
    }
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      department_id: data.department_id ?? null,
      avatar_path: finalAvatar,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (data.role === "DH" && data.department_id) {
      await supabaseAdmin.from("department_heads").insert({ user_id: uid, department_id: data.department_id });
    }
    if (data.role === "T" && data.department_id) {
      const { data: tr } = await supabaseAdmin.from("trainer_registry").insert({
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        department_id: data.department_id,
      }).select().single();
      if (tr) {
        await supabaseAdmin.from("profiles").update({ trainer_registry_id: tr.id }).eq("id", uid);
      }
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "CREATE_USER", entity_type: "profiles", entity_id: uid,
      after_state: { email: data.email, role: data.role, phone: data.phone, department_id: data.department_id ?? null },
    });
    return { ok: true, user_id: uid };
  });

export const toggleBypassGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), bypass: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "toggleBypassGeofence");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ bypass_geofence: data.bypass }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "TOGGLE_BYPASS", entity_type: "profiles", entity_id: data.user_id,
      after_state: { bypass_geofence: data.bypass },
    });
    return { ok: true };
  });

export const updateUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      roles: z.array(z.enum(["MA", "DH", "T"])).min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "updateUserRoles");
    const { error } = await context.supabase.rpc("admin_update_user_roles", {
      _user_id: data.user_id,
      _roles: data.roles,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTrainerDepartments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      department_ids: z.array(z.string().uuid()).min(1),
      primary_department_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "setTrainerDepartments");
    const { error } = await context.supabase.rpc("admin_set_trainer_departments", {
      _user_id: data.user_id,
      _department_ids: data.department_ids,
      _primary_id: data.primary_department_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDHDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      department_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "setDHDepartment");
    const { error } = await context.supabase.rpc("admin_set_dh_department", {
      _user_id: data.user_id,
      _department_id: data.department_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** MA updates any user's telephone (profile + linked trainer registry). */
export const adminSetUserPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      phone: z
        .string()
        .trim()
        .min(1, "Telephone number is required.")
        .max(40)
        .refine((v) => normalizeEtPhone(v) !== null, {
          message: "Please enter a valid Ethiopian telephone number.",
        })
        .transform((v) => normalizeEtPhone(v) as string),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "adminSetUserPhone");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles").select("trainer_registry_id, phone").eq("id", data.user_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const { assertPhoneAvailable } = await import("@/lib/phone-uniqueness.server");
    await assertPhoneAvailable(data.phone, {
      profileId: data.user_id,
      trainerId: profile?.trainer_registry_id ?? null,
    });
    const { error } = await supabaseAdmin.from("profiles")
      .update({ phone: data.phone }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    if (profile?.trainer_registry_id) {
      await supabaseAdmin.from("trainer_registry")
        .update({ phone: data.phone }).eq("id", profile.trainer_registry_id);
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "UPDATE_PHONE", entity_type: "profiles", entity_id: data.user_id,
      before_state: { phone: profile?.phone ?? null }, after_state: { phone: data.phone },
    });
    return { ok: true, phone: data.phone };
  });

/** MA suspends or reactivates a user account (blocks sign-in when suspended). */
export const adminSetUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      email: z.string().trim().email("Please enter a valid email address.").max(255)
        .transform((v) => v.toLowerCase()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "adminSetUserEmail");
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles").select("trainer_registry_id, email").eq("id", data.user_id).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    const { data: clash } = await supabaseAdmin
      .from("profiles").select("id, full_name").eq("email", data.email).neq("id", data.user_id).maybeSingle();
    if (clash) {
      throw new Error(`This email address is already used by ${clash.full_name || "another user"}.`);
    }
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      email: data.email,
      email_confirm: true,
    } as any);
    if (authErr) throw new Error(authErr.message);
    const { error } = await supabaseAdmin.from("profiles")
      .update({ email: data.email }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    if (profile?.trainer_registry_id) {
      await supabaseAdmin.from("trainer_registry")
        .update({ email: data.email }).eq("id", profile.trainer_registry_id);
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "UPDATE_EMAIL", entity_type: "profiles", entity_id: data.user_id,
      before_state: { email: profile?.email ?? null }, after_state: { email: data.email },
    });
    return { ok: true, email: data.email };
  });

/** MA suspends or reactivates a user account (blocks sign-in when suspended). */
export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "adminSetUserActive");
    if (data.user_id === context.userId && !data.active) {
      throw new Error("You cannot suspend your own account.");
    }
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("trainer_registry_id, active").eq("id", data.user_id).maybeSingle();
    const { error } = await supabaseAdmin.from("profiles")
      .update({ active: data.active }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    if (profile?.trainer_registry_id) {
      await supabaseAdmin.from("trainer_registry")
        .update({ status: data.active ? "ACTIVE" : "SUSPENDED" }).eq("id", profile.trainer_registry_id);
    }
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);
    if (banErr) throw new Error(banErr.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: data.active ? "ACTIVATE_USER" : "SUSPEND_USER",
      entity_type: "profiles", entity_id: data.user_id,
      before_state: { active: profile?.active ?? null },
      after_state: { active: data.active },
    });
    return { ok: true, active: data.active };
  });