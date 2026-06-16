import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveSignedInHome } from "@/lib/auth-routing";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { user, to } = await resolveSignedInHome();
    if (!user) throw redirect({ to: "/login" });
    if (to) throw redirect({ to });
    throw redirect({ to: "/login", search: { error: "no_role" } as never });
  },
  component: () => null,
});
