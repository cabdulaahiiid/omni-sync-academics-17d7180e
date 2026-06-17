# Fix login + harden role security (single deployment)

## Problems to solve

1. **Auto-logout after sign-in.** Session is established, dashboard flashes, then user is bounced to `/login` — sometimes with "No role assigned". Root cause: the protected layout and `useMe` race against Supabase session hydration and the `user_roles` RLS read, and any transient 401 from a protected server fn tears the cache down.
2. **Role security is inconsistent.** Some server fns rely on RLS only; a few still do client-side role checks; T/DH/MA route gating is not uniformly enforced both client-side and server-side.

## Fix plan

### A. Stop the auto-logout (login persistence)

- `_authenticated/route.tsx`: keep `ssr: false`, but gate on `getReadyAuthenticatedUser()` (session-first, then user) and render `AuthGate` until `authReady === true`. No redirect while `authReady` is `false`.
- `use-auth-session.ts`: drive `authReady`/`hasSession`/`userId` purely from `getSession()` + `onAuthStateChange`. Ignore `TOKEN_REFRESHED` / `INITIAL_SESSION` for routing decisions (only `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED` invalidate).
- Root `__root.tsx`: ensure exactly one `onAuthStateChange` subscriber; on `SIGNED_OUT` only `queryClient.clear()` + navigate, never `invalidateQueries()` (prevents 401 storm that looks like auto-logout).
- `use-me.ts`: never throw on transient role-fetch errors; expose `rolesReady`. A 401/empty result must NOT trigger sign-out.
- `login.tsx`: after `signInWithPassword`, call `resolveSignedInHome()` (with retry/backoff already in `auth-routing.ts`) and navigate. Do not call `signOut()` on the "no role" branch — show inline message only.
- Remove any lingering `supabase.auth.signOut()` calls in error paths of `auth-routing.ts`, `use-me.ts`, and route guards.

### B. Canonical roles: Trainer (T), Department Head (DH), Admin (MA)

Single source of truth in `src/lib/auth/roles.ts`:
```
ROLE_LABELS = { MA: "Admin", DH: "Department Head", T: "Trainer" }
ROLE_HOME   = { MA: "/strategic", DH: "/operational", T: "/ground" }
```

### C. Server-side enforcement on every protected server fn

Audit and apply `requireRole(ctx, [...], "<fn>")` at the top of every handler in:
- `ma.functions.ts`, `system-admin.functions.ts`, `users-admin.functions.ts`, `global-config.functions.ts` → `["MA"]`
- `dh.functions.ts`, `dh-ops.functions.ts`, `dh-extras.functions.ts`, `semester-drafts.functions.ts`, `approvals.functions.ts`, `approval-history.functions.ts`, `feedback.functions.ts`, `consistency.functions.ts` → `["DH","MA"]` (MA inherits)
- `trainer.functions.ts` → `["T","DH","MA"]` for read-self; mutations stay `["T"]` with `assertSelfOrRole`
- `dashboard.functions.ts`, `data.functions.ts`, `notifications.functions.ts`, `profile.functions.ts`, `modules.functions.ts`, `students.functions.ts`, `reports.functions.ts`, `exports.functions.ts` → role-scope each handler individually (read what your role owns)
- `seed.functions.ts` → `["MA"]` and guard behind `has_role` RPC

`ForbiddenError` (HTTP 403) is logged via `auth_events` and never triggers client sign-out.

### D. Client-side route gating per role

New pathless layouts (no UI change, just `beforeLoad`):
- `_authenticated/_ma.tsx` → requires MA, else redirect to user's home
- `_authenticated/_dh.tsx` → requires DH or MA
- `_authenticated/_t.tsx` → requires T, DH, or MA

Move existing route files under the matching layout:
- `strategic/*` → under `_ma`
- `operational/*` → under `_dh`
- `ground/*` → under `_t`
- `profile.tsx`, `print.$report.tsx` stay shared

`index.tsx` resolves `resolveSignedInHome()` and redirects to the role home; no role → `/login?error=no_role`.

### E. RLS sanity pass (migration)

Verify and (where missing) add policies so:
- `user_roles`: `SELECT` allowed `TO authenticated USING (user_id = auth.uid())` — required for the client role read used by routing.
- `profiles`: self read/update; MA read all.
- `auth_events`: insert allowed for authenticated; select MA-only (already in place).
- `has_role(uuid, app_role)` exists (already present) and is used by every privileged DB function.

No table grants change beyond what's required for the policies above.

### F. Telemetry & tests (already scaffolded, extend coverage)

- Add `role_resolve_retry` event firing inside `loadRolesAfterAuthReady` per attempt.
- Add tests:
  - `auth-routing.test.ts`: role precedence (MA > DH > T) — already covered, extend to retry success.
  - `require-role.test.ts`: extend with "MA passes DH-required check" case.
  - `login.test.tsx` (jsdom, optional if jsdom is not yet wired — otherwise skip).

## Files touched

**New**
- `src/lib/auth/roles.ts`
- `src/routes/_authenticated/_ma.tsx`, `_dh.tsx`, `_t.tsx`
- One migration: ensure `user_roles` SELECT policy + any missing GRANTs

**Edited**
- `src/routes/_authenticated.tsx`, `src/routes/index.tsx`, `src/routes/login.tsx`
- `src/hooks/use-auth-session.ts`, `src/hooks/use-me.ts`
- `src/routes/__root.tsx` (auth listener hygiene only)
- `src/lib/auth-routing.ts` (retry telemetry)
- Every `*.functions.ts` listed in §C (insert `requireRole` at top of each handler)
- Route file relocations under `_ma` / `_dh` / `_t` (imports updated; UI unchanged)

## Out of scope

- UI redesign of strategic/operational/ground dashboards
- New admin telemetry page
- OAuth/SSO changes

Approve to implement in a single deployment.