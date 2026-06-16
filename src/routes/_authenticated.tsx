import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getReadyAuthenticatedUser } from "@/lib/auth-routing";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getReadyAuthenticatedUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});