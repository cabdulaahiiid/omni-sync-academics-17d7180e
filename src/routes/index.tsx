import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (set.has("MA")) throw redirect({ to: "/strategic" });
    if (set.has("DH")) throw redirect({ to: "/operational" });
    if (set.has("T")) throw redirect({ to: "/ground" });
    throw redirect({ to: "/login", search: { error: "no_role" } as never });
  },
  component: () => null,
});
