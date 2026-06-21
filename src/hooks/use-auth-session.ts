import { useAuthContext } from "@/lib/auth/auth-provider";

/**
 * Thin wrapper around the centralized AuthProvider context. Kept for
 * back-compat with existing call sites. There is no listener here — the
 * single global `onAuthStateChange` lives in `AuthProvider`.
 */
export function useAuthSession() {
  const { authReady, hasSession, userId } = useAuthContext();
  return { authReady, hasSession, userId };
}