import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertMA(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "MA").maybeSingle();
  if (!data) throw new Error("Master Admin only");
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMA(context.supabase, context.userId);
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, department_id, bypass_geofence, active, created_at, avatar_path")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p) => p.id);
    const [{ data: roles }, { data: depts }] = await Promise.all([
      ids.length ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      supabaseAdmin.from("departments").select("id, name"),
    ]);
    const roleMap: Record<string, string[]> = {};
    for (const r of roles ?? []) {
      (roleMap[r.user_id] = roleMap[r.user_id] ?? []).push(r.role as string);
    }
    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]));
    const withAvatars = await Promise.all(
      (profiles ?? []).map(async (p) => {
        let avatar_url: string | null = null;
        if (p.avatar_path) {
          const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(p.avatar_path, 60 * 60);
          avatar_url = signed?.signedUrl ?? null;
        }
        return {
          ...p,
          avatar_url,
          roles: roleMap[p.id] ?? [],
          department_name: p.department_id ? dMap[p.department_id] ?? "—" : "—",
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
      avatar_path: z.string().min(1).max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMA(context.supabase, context.userId);
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
        department_id: data.department_id,
      }).select().single();
      if (tr) {
        await supabaseAdmin.from("profiles").update({ trainer_registry_id: tr.id }).eq("id", uid);
      }
    }
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "CREATE_USER", entity_type: "profiles", entity_id: uid,
      after_state: { email: data.email, role: data.role, department_id: data.department_id ?? null },
    });
    return { ok: true, user_id: uid };
  });

export const toggleBypassGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), bypass: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMA(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("profiles")
      .update({ bypass_geofence: data.bypass }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "TOGGLE_BYPASS", entity_type: "profiles", entity_id: data.user_id,
      after_state: { bypass_geofence: data.bypass },
    });
    return { ok: true };
  });