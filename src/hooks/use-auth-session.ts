import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks whether a Supabase session is hydrated.
 * The bearer token is attached to serverFn calls automatically by
 * `attachSupabaseAuth` (see src/start.ts) — no need to pass it manually.
 */
export function useAuthSession() {
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setHasSession(Boolean(data.user) && !error);
      setUserId(error ? null : (data.user?.id ?? null));
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.access_token));
      setUserId(session?.user?.id ?? null);
      setAuthReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { authReady, hasSession, userId };
}