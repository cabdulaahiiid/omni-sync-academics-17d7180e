import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    throw redirect({ to: "/admin" });
  },
  component: Index,
});

function Index() {
  return null;
}
