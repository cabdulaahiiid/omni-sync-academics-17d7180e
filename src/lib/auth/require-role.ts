import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "MA" | "DH" | "T" | "PD" | "CO" | "VT" | "EM" | "TR";

export class ForbiddenError extends Error {
  status = 403;
  code = "FORBIDDEN";
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

type Ctx = { supabase: SupabaseClient<any>; userId: string };

async function getUserRoles(ctx: Ctx): Promise<AppRole[]> {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);
  if (error) return [];
  return (data ?? [])
    .map((r: { role: string }) => r.role)
    .filter((r): r is AppRole => ["MA","DH","T","PD","CO","VT","EM","TR"].includes(r));
}

export async function requireRole(
  ctx: Ctx,
  roles: AppRole[],
  fnName?: string,
): Promise<AppRole[]> {
  const userRoles = await getUserRoles(ctx);
  const ok = userRoles.some((r) => roles.includes(r));
  if (!ok) {
    // Fire-and-forget telemetry
    try {
      const { logAuthEvent } = await import("./telemetry");
      await logAuthEvent(ctx.supabase, {
        kind: "forbidden_call",
        userId: ctx.userId,
        ok: false,
        reason: fnName ?? "unknown",
        meta: { required: roles, actual: userRoles },
      });
    } catch {
      /* swallow */
    }
    throw new ForbiddenError(
      `Forbidden: requires role ${roles.join(" or ")}`,
    );
  }
  return userRoles;
}

export async function assertSelfOrRole(
  ctx: Ctx,
  targetUserId: string,
  roles: AppRole[],
  fnName?: string,
): Promise<void> {
  if (ctx.userId === targetUserId) return;
  await requireRole(ctx, roles, fnName);
}