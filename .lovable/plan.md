## Goal

Place the signed-in user's avatar, name, and role at the top-right of the header, next to the notifications bell, on every admin screen.

## Changes

**File:** `src/components/strategic/strategic-shell.tsx`

1. In the sticky `<header>`, between `NotificationsBell` and the quick-actions `+` dropdown, insert a compact identity chip:
   - `Avatar` (28px) showing `me.avatar_url` with initials fallback from `me.profile.full_name`/`email`
   - Two stacked lines: name (truncated, semibold, 13px) and primary role label (10px, muted)
   - Role label derived from `me.roles` with priority `MA → Master Admin`, `DH → Department Head`, `TR → Trainer`, else `User`
   - Wrap in a `Link` to `/profile` so clicking it opens the profile page (mirrors existing "My profile" sidebar action)
   - Hidden name/role on very small screens (`hidden sm:flex`), avatar always visible

2. Remove the duplicate user card currently in the sidebar (the block above the nav showing avatar + name + "Master Admin") so identity lives in one canonical place — the header. The sidebar keeps only the college brand header.

## Out of scope

- No backend/data changes; `useMe()` already returns `avatar_url`, `profile`, and `roles`.
- No changes to other shells (trainer/DH mobile views) unless requested.
- No changes to notifications, search, or quick-create dropdown behavior.
