import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMe } from "@/lib/data.functions";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const fn = useServerFn(getMe);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: () => fn(),
    enabled: authReady && hasSession,
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setAuthReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    ...query,
    isLoading: !authReady || (hasSession && query.isLoading),
  };
}