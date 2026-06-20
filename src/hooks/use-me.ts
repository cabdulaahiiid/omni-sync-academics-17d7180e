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
    // Retry on transient failures (network blips, auth-token race right after
    // sign-in). Up to 4 attempts with backoff so we never flash "No role
    // assigned" because of a single failed request.
    retry: 4,
    retryDelay: (attempt) => Math.min(300 * 2 ** attempt, 2000),
    throwOnError: false,
    staleTime: 30_000,
  });
  return {
    ...query,
    isLoading: !authReady || (hasSession && query.isLoading),
    rolesReady: authReady && hasSession && !query.isLoading && !query.isFetching,
  };
}