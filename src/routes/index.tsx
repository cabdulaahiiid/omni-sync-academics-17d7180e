import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
  const { data: me, rolesReady } = useMe();
  const navigate = useNavigate();

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
    } else {
      void navigate({
        to: "/login",
        replace: true,
        search: { error: "no_role" } as never,
      });
    }
  }, [authReady, hasSession, rolesReady, me?.roles, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading your workspace…</span>
      </div>
    </div>
  );
}
