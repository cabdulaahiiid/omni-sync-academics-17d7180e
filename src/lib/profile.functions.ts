import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertMA(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "MA").maybeSingle();
  if (!data) throw new Error("Master Admin only");
}

// Update own avatar_path; the upload itself happens client-side via the supabase storage client.
export const updateMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ avatar_path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles").update({ avatar_path: data.avatar_path }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// MA promotes a pending/* upload to a user's own folder and writes avatar_path on their profile
export const adminSetUserAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), avatar_path: z.string().min(1).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let finalPath = data.avatar_path;
    if (data.avatar_path.startsWith("pending/")) {
      const ext = data.avatar_path.split(".").pop() || "jpg";
      finalPath = `${data.user_id}/avatar-${Date.now()}.${ext}`;
      const { error: mvErr } = await supabaseAdmin.storage.from("avatars").move(data.avatar_path, finalPath);
      if (mvErr) throw new Error(mvErr.message);
    }
    const { error } = await supabaseAdmin.from("profiles").update({ avatar_path: finalPath }).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "UPDATE_AVATAR", entity_type: "profiles", entity_id: data.user_id,
      after_state: { avatar_path: finalPath },
    });
    return { ok: true, avatar_path: finalPath };
  });

// MA changes any user's password
export const adminChangeUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), new_password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMA(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, action_type: "ADMIN_PASSWORD_RESET", entity_type: "profiles", entity_id: data.user_id,
    });
    return { ok: true };
  });

// Self password change: re-auth then update
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ current_password: z.string().min(1), new_password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify current password by attempting a sign-in using the email
    const { data: profile } = await context.supabase.from("profiles").select("email").eq("id", context.userId).maybeSingle();
    if (!profile?.email) throw new Error("Profile not found");
    const { error: verifyErr } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email, password: data.current_password,
    });
    if (verifyErr) throw new Error("Current password is incorrect");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.new_password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Get a fresh signed URL for any avatar path (caller must be authorised by RLS)
export const getSignedAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ avatar_path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("avatars").createSignedUrl(data.avatar_path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });