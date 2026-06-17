import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";

export function useMe() {
  const { authReady, hasSession, userId } = useAuthSession();
  const fn = useServerFn(getMe);
  const query = useQuery({
    queryKey: ["me", userId],
    queryFn: () => fn(),
    enabled: authReady && hasSession && Boolean(userId),
    retry: false,
    throwOnError: false,
  });
  return {
    ...query,
    isLoading: !authReady || (hasSession && query.isLoading),
    rolesReady: authReady && hasSession && !query.isLoading && !query.isFetching,
  };
}