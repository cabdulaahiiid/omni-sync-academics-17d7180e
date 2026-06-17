import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export const getAuthHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "getAuthHealth");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("auth_events")
      .select("kind, ok, duration_ms, attempts, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const counts: Record<string, number> = {};
    const durations: number[] = [];
    let signInOk = 0;
    let signInFail = 0;
    let forbidden = 0;
    let resolveOk = 0;
    let resolveEmpty = 0;

    for (const r of rows) {
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
      if (r.kind === "sign_in_success") signInOk += 1;
      else if (r.kind === "sign_in_fail") signInFail += 1;
      else if (r.kind === "forbidden_call") forbidden += 1;
      else if (r.kind === "role_resolve_ok") {
        resolveOk += 1;
        if (typeof r.duration_ms === "number") durations.push(r.duration_ms);
      } else if (r.kind === "role_resolve_empty") {
        resolveEmpty += 1;
      }
    }
    durations.sort((a, b) => a - b);
    const p95 = durations.length
      ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
      : 0;

    return {
      window: "24h",
      total: rows.length,
      counts,
      sign_in_ok: signInOk,
      sign_in_fail: signInFail,
      forbidden_calls: forbidden,
      role_resolve_ok: resolveOk,
      role_resolve_empty: resolveEmpty,
      role_resolve_p95_ms: p95,
    };
  });