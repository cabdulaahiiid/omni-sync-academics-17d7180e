import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthEventKind =
  | "sign_in_success"
  | "sign_in_fail"
  | "role_resolve_ok"
  | "role_resolve_empty"
  | "role_resolve_retry"
  | "forbidden_call";

export interface AuthEvent {
  kind: AuthEventKind;
  userId?: string | null;
  durationMs?: number;
  attempts?: number;
  ok?: boolean;
  reason?: string;
  meta?: Record<string, unknown>;
}

export async function logAuthEvent(
  supabase: SupabaseClient<any>,
  event: AuthEvent,
): Promise<void> {
  try {
    await supabase.from("auth_events").insert({
      kind: event.kind,
      user_id: event.userId ?? null,
      duration_ms: event.durationMs ?? null,
      attempts: event.attempts ?? null,
      ok: event.ok ?? null,
      reason: event.reason ?? null,
      meta: event.meta ?? null,
    });
  } catch {
    /* never throw from telemetry */
  }
}