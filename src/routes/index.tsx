import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useMe } from "@/hooks/use-me";
import { pickHome } from "@/lib/auth/roles";

export const Route = createFileRoute("/")({
  ssr: false,
  component: HomeRedirect,
});

function HomeRedirect() {
  const { authReady, hasSession } = useAuthSession();
  const { data: me, rolesReady, isError, refetch } = useMe();
  const navigate = useNavigate();
  const [showRoleError, setShowRoleError] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!hasSession) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!rolesReady) return;
    const home = pickHome(me?.roles ?? []);
    if (home) {
      void navigate({ to: home, replace: true });
      return;
    }
    // Roles resolved empty — wait briefly and refetch once before showing
    // the error. Covers the brief window where a freshly granted role row
    // hasn't yet replicated. Never auto-signOut.
    const t = setTimeout(() => {
      void refetch().then((r) => {
        const home2 = pickHome(r.data?.roles ?? []);
        if (home2) {
          void navigate({ to: home2, replace: true });
        } else {
          setShowRoleError(true);
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [authReady, hasSession, rolesReady, me?.roles, navigate, refetch]);

  if (showRoleError || (rolesReady && isError && hasSession)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">No role assigned</h1>
          <p className="text-sm text-muted-foreground">
            Your account is signed in but has no role yet. Please contact your
            administrator, then retry.
          </p>
          <button
            onClick={() => {
              setShowRoleError(false);
              void refetch();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading your workspace…</span>
      </div>
    </div>
  );
}
