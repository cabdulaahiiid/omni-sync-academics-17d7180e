## Problem

After signing in you land on the dashboard for a split second, then get bounced back to `/login` — and sometimes see "No role assigned — contact administrator". This is one bug with two surfaces.

## Root cause

The Supabase session lives in the browser's `localStorage`. The server has no way to read it. Two route files run auth checks during SSR with no session available:

1. `src/routes/_authenticated.tsx` — `beforeLoad` calls `supabase.auth.getUser()`. On the server this returns no user → it throws `redirect({ to: "/login" })`. That's the "auto-logout right after login".
2. `src/routes/index.tsx` — `beforeLoad` calls `supabase.auth.getUser()` then queries `user_roles`. Server-side has no session → `user_roles` returns `[]` under RLS → falls through to the "no_role" branch and bounces to `/login`. That's the "no role assigned" toast (it fires when a navigation to `/` happens after sign-in).

Neither route opts out of SSR, so every hard refresh / first navigation hits this.

## Fix

Mark both auth-touching routes as client-only so the session check actually sees the browser session.

### 1. `src/routes/_authenticated.tsx`
Add `ssr: false` to the route config. Keep the existing `beforeLoad` redirect logic.

```ts
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
```

### 2. `src/routes/index.tsx`
Add `ssr: false` so the role lookup runs in the browser with the real session. Logic stays the same.

```ts
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => { /* unchanged */ },
  component: () => null,
});
```

## Out of scope

- No changes to `login.tsx`, RLS, migrations, or the role-routing logic itself — those are correct, they just weren't being reached with a valid session.
- No changes to `useAuthSession`, `getMe`, or any server function.

## Verification

After the change: sign in → land on `/strategic` (MA) / `/operational` (DH) / `/ground` (T) and stay there. Hard refresh on any `_authenticated/*` page keeps you signed in instead of bouncing to `/login`.
