## Root Cause

`/strategic/index.tsx` violates the Rules of Hooks. The component early-returns when `meLoading` is true at line 104, but then calls `useMemo` (line 126) and `useEffect` (line 136) further down. React renders once with N hooks (early-return path), then re-renders with N+2 hooks once `me` resolves → React throws *"Rendered more hooks than during the previous render"*. The route's error boundary catches it and renders the generic **"This page didn't load"** page that the user is seeing right after a successful login.

Auth itself works fine (Supabase logs show clean 200s on `/token` and `/user`, session is persisted, `_authenticated` guard passes, the shell mounts). The crash happens inside the dashboard component only.

## Fix

Single file change — `src/routes/_authenticated/strategic/index.tsx`:

1. Move the `meLoading` early-return **below** every hook call (after the `useMemo` for `health`, the `writeHealth` `useEffect`, and the `insights`/`reportingStats` `useMemo`s). Hooks must run unconditionally on every render.
2. Guard the hook bodies with `if (!kpi) return null/[]` instead of relying on the early return — they already tolerate missing `kpi` (the existing `kpi ? compute… : null` pattern stays).
3. Keep the loading placeholder by rendering `<div>Loading…</div>` from the JSX branch after all hooks have run (e.g. `if (meLoading) return <Loading/>` placed right before the final `return (...)`).

No other files touched. No UI/UX changes, no design changes, no auth changes, no server-fn changes. The shell, sidebar, KPIs, and downstream pages already render correctly once the dashboard component stops throwing.

## Verification

- Reload `/strategic` after login — page renders the Command Center instead of the error fallback.
- Click through sidebar links (Approvals, Audit, Departments, Students, etc.) — all already-built pages mount.
- Sign out → redirected to `/login`; sign in again → land on `/strategic` cleanly.
