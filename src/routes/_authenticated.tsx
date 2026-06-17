import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/auth-gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // No beforeLoad redirect — it races with Supabase session hydration after
  // login (causing the "dashboard flashes then bounce to /login"). AuthGate
  // waits for authReady on the client and only then decides to redirect.
  component: () => (
    <AuthGate>
      <Outlet />
    </AuthGate>
  ),
});