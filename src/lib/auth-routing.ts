import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth/telemetry";

type AppRole = "MA" | "DH" | "T";
export type RoleHome = "/strategic" | "/operational" | "/ground";

const ROLE_RETRY_DELAYS_MS = [0, 150, 300, 600, 900, 1200];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getReadyAuthenticatedUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const sessionUser = sessionData.session?.user ?? null;
  if (!sessionUser) return null;

  const { data: userData } = await supabase.auth.getUser();
  return userData.user ?? sessionUser;
}

export function getHomeForRoles(roles: AppRole[]): RoleHome | null {
  const set = new Set(roles);
  if (set.has("MA")) return "/strategic";
  if (set.has("DH")) return "/operational";
  if (set.has("T")) return "/ground";
  return null;
}

export async function loadRolesAfterAuthReady(userId: string): Promise<AppRole[]> {
  let lastError: Error | null = null;
  const startedAt = Date.now();
  let attempts = 0;

  for (const delay of ROLE_RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    attempts += 1;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) {
      lastError = new Error(error.message);
      continue;
    }

    const roles = (data ?? [])
      .map((row) => row.role)
      .filter((role): role is AppRole => role === "MA" || role === "DH" || role === "T");

    if (roles.length > 0) {
      void logAuthEvent(supabase, {
        kind: "role_resolve_ok",
        userId,
        attempts,
        durationMs: Date.now() - startedAt,
        ok: true,
        meta: { roles },
      });
      return roles;
    }
  }

  void logAuthEvent(supabase, {
    kind: "role_resolve_empty",
    userId,
    attempts,
    durationMs: Date.now() - startedAt,
    ok: false,
    reason: lastError?.message,
  });

  if (lastError) throw lastError;
  return [];
}

export async function resolveSignedInHome(userId?: string) {
  const user = userId ? { id: userId } : await getReadyAuthenticatedUser();
  if (!user) return { user: null, roles: [] as AppRole[], to: null as RoleHome | null };

  const roles = await loadRolesAfterAuthReady(user.id);
  return { user, roles, to: getHomeForRoles(roles) };
}