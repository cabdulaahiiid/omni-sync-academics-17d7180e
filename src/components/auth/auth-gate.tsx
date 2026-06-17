import { useAuthSession } from "@/hooks/use-auth-session";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Client-side gate for any subtree that requires an authenticated session.
 *
 * - While Supabase hydrates the session, render a stable loader (no redirect,
 *   no flicker).
 * - Only after `authReady === true` AND `hasSession === false` do we redirect
 *   to /login. This prevents the post-login "dashboard flashes then bounces
 *   to /login" symptom that comes from racing a router `beforeLoad` against
 *   the async session restore.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authReady, hasSession } = useAuthSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && !hasSession) {
      void navigate({ to: "/login", replace: true });
    }
  }, [authReady, hasSession, navigate]);

  if (!authReady || (authReady && !hasSession)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Signing you in…</span>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}