import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

const FULL_TABLES = [
  "attendance_overrides",
  "attendance_logs",
  "session_logs",
  "pending_sync",
  "schedule_feedback_messages",
  "schedule_feedback_threads",
  "approval_queue",
  "schedules",
  "semester_registry",
  "students",
  "trainer_skills",
  "modules",
  "leave_requests",
  "notifications",
  "sections",
  "levels",
  "venues",
  "trainer_registry",
  "department_heads",
  "departments",
  "profiles",
  "user_roles",
  "audit_logs",
] as const;

const ACADEMIC_TABLES = [
  "attendance_overrides",
  "attendance_logs",
  "session_logs",
  "pending_sync",
  "schedule_feedback_messages",
  "schedule_feedback_threads",
  "approval_queue",
  "schedules",
  "semester_registry",
  "students",
  "trainer_skills",
  "modules",
  "leave_requests",
  "notifications",
  "trainer_registry",
] as const;

export const getWipePreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "getWipePreview");
    const counts: Record<string, number> = {};
    await Promise.all(
      FULL_TABLES.map(async (t) => {
        const { count } = await context.supabase.from(t).select("id", { count: "exact", head: true });
        counts[t] = count ?? 0;
      }),
    );
    const full_total = FULL_TABLES.reduce((a, t) => a + (counts[t] ?? 0), 0);
    const academic_total = ACADEMIC_TABLES.reduce((a, t) => a + (counts[t] ?? 0), 0);
    return {
      counts,
      full_total,
      academic_total,
      full_tables: FULL_TABLES as readonly string[],
      academic_tables: ACADEMIC_TABLES as readonly string[],
    };
  });

export const wipeEntireSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ confirm_phrase: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "wipeEntireSystem");
    if (data.confirm_phrase !== "WIPE ENTIRE SYSTEM") {
      throw new Error("Confirmation phrase did not match.");
    }
    const { error } = await context.supabase.rpc("wipe_entire_system");
    if (error) throw new Error(error.message);

    // Delete every auth user except the calling MA
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let page = 1;
    while (true) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr) throw new Error(listErr.message);
      const users = list?.users ?? [];
      if (!users.length) break;
      for (const u of users) {
        if (u.id === context.userId) continue;
        await supabaseAdmin.auth.admin.deleteUser(u.id);
      }
      if (users.length < 200) break;
      page += 1;
      if (page > 50) break;
    }
    return { ok: true };
  });

export const resetAcademicData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ confirm_phrase: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "resetAcademicData");
    if (data.confirm_phrase !== "RESET ACADEMIC DATA") {
      throw new Error("Confirmation phrase did not match.");
    }
    const { error } = await context.supabase.rpc("reset_academic_data");
    if (error) throw new Error(error.message);
    return { ok: true };
  });