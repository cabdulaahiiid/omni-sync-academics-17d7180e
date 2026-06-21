## Plan: Fix authentication stability only

### Scope
- Preserve all ERP modules and UI.
- Change only authentication/session/role initialization code and, if needed, a small database policy/diagnostic migration.

### What I found
- There are currently **two auth listeners**:
  - `src/hooks/use-auth-session.ts`
  - `src/routes/__root.tsx`
- Multiple components call `useAuthSession()`, so the listener in that hook can be mounted more than once.
- `getMe` currently queries profile and roles in parallel and does not validate/throw on profile/role query errors, which can turn temporary auth/RLS failures into an empty role result.
- RLS already allows authenticated users to read their own `profiles` and `user_roles` rows.
- Data check found one user with **one profile but zero role records**. That account should continue showing a real “No role assigned” error after retries, but valid users should not see false errors.

### Implementation steps
1. **Add a centralized `AuthProvider`**
   - Create a React auth context/provider.
   - On app start, call `supabase.auth.getSession()` first and wait for restoration.
   - Then validate the session user with `supabase.auth.getUser()` when a session exists.
   - Maintain a single source of truth: `authReady`, `session`, `user`, `hasSession`, `userId`, auth errors.
   - Add detailed console logging for session restoration and auth state transitions.

2. **Use exactly one auth listener**
   - Move `supabase.auth.onAuthStateChange` into the new `AuthProvider`.
   - Remove the root `AuthSync` listener from `src/routes/__root.tsx`.
   - Update `useAuthSession()` to read the provider context only, with no listener of its own.
   - Keep query/router invalidation behavior inside the provider for `SIGNED_IN`, `SIGNED_OUT`, and `USER_UPDATED`; ignore noisy token refresh events except for session state updates.

3. **Enforce load order: Session → Profile → Role → Dashboard**
   - Update `getMe` to load the profile first, then roles.
   - Check query errors explicitly.
   - Return diagnostic status such as `profileStatus`, `roleStatus`, and `roleCount`.
   - Log role/profile resolution failures to the existing `auth_events` table when possible.

4. **Make role/profile loading resilient**
   - Add retry/backoff around `getMe` in `useMe`.
   - Do not show “No role assigned” until:
     - session restoration is complete,
     - a valid session exists,
     - profile/role queries have completed and retried,
     - the final role result is truly empty.
   - Never call `signOut()` because a profile or role query failed.

5. **Gate redirects safely**
   - `AuthGate` will redirect to `/login` only after auth restoration completes and there is definitely no valid session.
   - `/` will navigate to the correct dashboard only after `getMe` finishes successfully and roles are initialized.
   - `/login` will navigate to `/` after sign-in and let the centralized flow resolve the dashboard.

6. **Verify profile/role integrity and RLS**
   - Add a read-only diagnostic server function for current-user auth health, or improve logging in `getMe`, so admins can debug profile/role problems without exposing secrets.
   - If database constraints are missing, add a migration only for safe integrity/RLS guarantees already implied by the app:
     - ensure profile id uniqueness via existing primary key,
     - preserve existing `user_roles` uniqueness,
     - keep/repair self-read policies if needed.
   - I will not auto-assign roles to the user that currently has zero roles, because that is a data/admin decision.

### Verification
- Confirm codebase has only one `onAuthStateChange` call.
- Confirm no auth flow signs users out on role/profile failure.
- Verify RLS policies still allow users to read their own profile and role.
- Use the preview/browser to test refresh and reload behavior where possible.
- Confirm dashboard routing waits for role initialization before navigation.

### Expected result
- Stable login and refresh behavior.
- No random automatic logouts.
- No false “No role assigned” errors for valid users.
- A real no-role account still gets a clear error after retries.
- Existing ERP modules and UI remain unchanged.