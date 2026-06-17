import { useAuthSession } from "@/hooks/use-auth-session";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { authReady } = useAuthSession();
  if (!authReady) {
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