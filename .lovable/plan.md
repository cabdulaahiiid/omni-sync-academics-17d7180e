# Auth & RBAC Hardening Plan

Goal: make the sign-in → role-resolution → role-gated route flow correct, observable, testable, and enforced server-side — without touching completed UI.

## 1. Server-side RBAC enforcement (highest priority)

Today many `*.functions.ts` use `requireSupabaseAuth` (any signed-in user) and rely on RLS for the actual gate. That works, but role-specific endpoints should fail fast with a clear 403 instead of returning empty/permission errors.

- Add `src/lib/auth/require-role.ts` exporting:
  - `requireRole(ctx, roles: AppRole[])` — calls `public.has_role` via the request-scoped supabase client; throws a typed `ForbiddenError` (HTTP 403) on miss.
  - `assertSelfOrRole(ctx, targetUserId, roles)` helper for "me-or-admin" endpoints.
- Audit `*.functions.ts` and apply `requireRole` at the top of every handler that is role-scoped:
  - MA-only: `system-admin.functions.ts` (already has inline assertMA → switch to helper), `ma.functions.ts`, `users-admin.functions.ts`, `seed.functions.ts`, `global-config.functions.ts`.
  - DH-or-MA: `dh.functions.ts`, `dh-extras.functions.ts`, `dh-ops.functions.ts`, `approvals.functions.ts`, `semester-drafts.functions.ts`, `modules.functions.ts`, `students.functions.ts`, `trainer.functions.ts`, `consistency.functions.ts`, `feedback.functions.ts`.
  - T-or-DH-or-MA: `dashboard.functions.ts` ground-only paths.
- Public to any signed-in user: `profile.functions.ts`, `notifications.functions.ts`, `getMe`.

Behavior: handlers that previously returned `[]` for an unauthorized role now throw `ForbiddenError`, surfaced to the client as a stable code.

## 2. Stable loading states for auth + roles

Eliminate the "split-second dashboard then bounce" flash and the noisy "no role assigned" toast.

- New `src/components/auth/auth-gate.tsx` — renders a neutral full-screen loader (skeleton, no role-specific chrome) while `authReady === false` OR roles are still being fetched. Used inside `_authenticated/route.tsx` component (wraps `<Outlet />`).
- Extend `useMe` to expose `rolesReady` (true once the `user_roles` retry chain in `loadRolesAfterAuthReady` settles, success or empty). Components rendering role-gated chrome read `rolesReady` instead of `isLoading`.
- `src/routes/index.tsx`: keep `beforeLoad` redirect logic, but only show "no_role" UI on the `/login` page when search param `error=no_role` is set (already wired) — drop transient toast.
- Login page: on success, `await resolveSignedInHome(userId)` already returns `to`. Show inline error text under the form when `to` is null instead of `toast.error` (less flashy, easier to test).

## 3. Telemetry & monitoring for role loading

Lightweight, server-only — no new infra.

- New `src/lib/auth/telemetry.ts`:
  - `logAuthEvent({ kind, userId, durationMs, attempts, ok, reason })` — inserts a row into a new `auth_events` table (see migration in §5).
  - Fire on: `sign_in_success`, `sign_in_fail`, `role_resolve_ok`, `role_resolve_empty`, `role_resolve_retry`, `forbidden_call`.
- Wrap `loadRolesAfterAuthReady` to record attempts + total duration; emit `role_resolve_empty` when all retries return `[]` so we can alert.
- `requireRole` records `forbidden_call` with `{ fn_name, required_roles, user_roles }`.
- Add a `getAuthHealth` MA-only server fn returning last-24h aggregates (counts by kind, p95 role-resolve duration) for a future admin page (no UI built now).

## 4. Authentication regression tests

Use Vitest + a thin Supabase mock — no live DB needed.

- `src/lib/auth-routing.test.ts`
  - `getHomeForRoles` priority: MA > DH > T; empty → null.
  - `loadRolesAfterAuthReady` retries on empty, returns on first non-empty page; total attempts capped.
  - `resolveSignedInHome` returns `{ user:null }` when no session, correct `to` for each role set.
- `src/lib/auth/require-role.test.ts`
  - Allows when `has_role` returns true; throws `ForbiddenError` otherwise; multi-role OR semantics.
- `src/hooks/use-auth-session.test.tsx` (jsdom)
  - Initial `authReady=false`; flips `true` after `getSession` resolves; updates on `onAuthStateChange`.
- `src/routes/login.test.tsx`
  - Bad credentials → inline error, no navigate.
  - Good credentials + role → `navigate({ to })` called with correct path.
  - Good credentials + no role → inline "no role" message, session not destroyed.
- Add `vitest.config.ts` if not present, `bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom`.

## 5. Backend support (single migration)

```sql
create table public.auth_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  user_id uuid,
  duration_ms int,
  attempts int,
  ok boolean,
  reason text,
  meta jsonb,
  created_at timestamptz not null default now()
);
grant insert on public.auth_events to authenticated;
grant select on public.auth_events to service_role;
grant all    on public.auth_events to service_role;
alter table public.auth_events enable row level security;
create policy "auth: self-insert" on public.auth_events
  for insert to authenticated with check (user_id is null or user_id = auth.uid());
create policy "auth: MA read"     on public.auth_events
  for select to authenticated using (public.has_role(auth.uid(),'MA'));
```

## Out of scope

- UI redesign of login, dashboards, shells, notification bell, header avatar.
- RLS policy rewrites (current policies stay; this layer is defense-in-depth).
- Switching to OAuth/SSO providers.
- Building an admin telemetry dashboard UI (data + endpoint only).

## Files touched

New: `src/lib/auth/require-role.ts`, `src/lib/auth/telemetry.ts`, `src/components/auth/auth-gate.tsx`, test files above, one migration.
Edited: every `*.functions.ts` listed in §1 (top-of-handler guard only), `src/hooks/use-auth-session.ts`, `src/hooks/use-me.ts`, `src/lib/auth-routing.ts`, `src/routes/_authenticated/route.tsx` wrapper, `src/routes/login.tsx` (toast → inline error only).
