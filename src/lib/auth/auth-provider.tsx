import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized auth state. Exactly ONE `onAuthStateChange` listener is
 * mounted for the whole app (this provider). All other code reads state
 * via `useAuthContext` / `useAuthSession`.
 *
 * Load order guarantees:
 *   1. `supabase.auth.getSession()` restores the persisted session.
 *   2. `authReady` flips to true only after that restore completes.
 *   3. Consumers (e.g. `useMe`) then fetch profile + role.
 *
 * We deliberately do NOT call `signOut()` on profile/role failures, and we
 * do NOT redirect while auth is still hydrating.
 */

export type AuthContextValue = {
  authReady: boolean;
  hasSession: boolean;
  userId: string | null;
  session: Session | null;
};

const AuthContext = createContext<AuthContextValue>({
  authReady: false,
  hasSession: false,
  userId: null,
  session: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();
  const qc = useQueryClient();
  const lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    // 1) Restore persisted session BEFORE anything else.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("[auth] getSession failed:", error.message);
        } else {
          console.info(
            "[auth] session restored:",
            data.session ? `user=${data.session.user.id}` : "no session",
          );
        }
        setSession(data.session ?? null);
        lastUserIdRef.current = data.session?.user?.id ?? null;
        setAuthReady(true);
      })
      .catch((err) => {
        if (!active) return;
        console.error("[auth] getSession threw:", err);
        setSession(null);
        lastUserIdRef.current = null;
        setAuthReady(true);
      });

    // 2) Single global auth listener. Only react to identity transitions —
    //    TOKEN_REFRESHED / INITIAL_SESSION still update `session` so the
    //    bearer attacher stays current, but they do NOT invalidate caches
    //    (that would race with in-flight server-fn calls).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        console.info("[auth] event:", event, "user:", nextSession?.user?.id ?? null);
        setSession(nextSession ?? null);
        if (!authReady) setAuthReady(true);

        if (
          event !== "SIGNED_IN" &&
          event !== "SIGNED_OUT" &&
          event !== "USER_UPDATED"
        ) {
          return;
        }

        const nextUserId = nextSession?.user?.id ?? null;
        if (lastUserIdRef.current === nextUserId && event !== "SIGNED_OUT") {
          return;
        }
        lastUserIdRef.current = nextUserId;

        if (event === "SIGNED_OUT") {
          qc.cancelQueries();
          qc.clear();
          router.invalidate();
          return;
        }
        router.invalidate();
        qc.invalidateQueries();
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthContextValue = {
    authReady,
    hasSession: Boolean(session?.access_token),
    userId: session?.user?.id ?? null,
    session,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}