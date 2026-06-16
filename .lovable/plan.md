## Goal

Place the user identity chip (avatar + name + role) in the top header right side, next to the notifications bell, across all three shells — matching the strategic shell pattern that was already done.

## Changes

### 1. `src/routes/_authenticated/operational.tsx` (Department Head shell)
- **Header**: After `<NotificationsBell />`, add the same identity chip used in strategic shell — a `Link` to `/profile` containing a 28px `Avatar` (with `me.avatar_url` or initials fallback), and a stacked label showing the full name (truncated, 13px semibold) and role ("Department Head" if DH, "Master Admin" if MA, else "User"). Text block hidden on small screens (`hidden sm:flex`); avatar always visible.
- **Sidebar**: Remove the duplicate user card (lines 55–64 — the avatar/name/"Department Head" block under the brand header). Identity lives only in the header.

### 2. `src/routes/_authenticated/ground.tsx` (Trainer mobile shell)
- **Header**: Replace the current left-side name/role text + right-side "Profile" link with the same compact identity chip on the right next to `NotificationsBell`. Left side keeps only the college logo + short name.
- Role label is "Trainer" (or "Master Admin" if MA). The chip wraps a `Link` to `/profile`, so the standalone "Profile" link is removed. Sign-out button stays.
- On the small mobile viewport, keep the name visible (so use `flex` rather than `hidden sm:flex`) but cap width with `max-w-[110px] truncate` so it fits next to the bell and sign-out button.

### 3. `src/components/strategic/strategic-shell.tsx`
- No change — already implements the canonical chip. Used as the visual reference for the other two shells.

## Out of scope
- No backend, data, or routing changes.
- No changes to `NotificationsBell`, sign-out, or sidebar navigation items.
- No new components extracted; the chip is small enough to inline in each shell (3 shells, ~15 lines each).
