## Problem
After clicking **Save as Draft** in the Semester Schedule Builder, the new sessions are correctly inserted as `status='DRAFT'` and would show up under DH → Schedule Manager → **Active Drafts**, but the Drafts page does not refresh because the builder invalidates the wrong React Query key, and the user gets no signal/path to the Drafts list.

- Builder invalidates: `["drafts"]`, `["schedules"]`, `["trainer-load"]`
- Drafts page actually uses: `["semester-drafts", deptId]` (and `["week-feedback-threads", deptId]`)
- The Supabase realtime channel on the Drafts page only fires if that page is already mounted; the builder lives on a different route, so nothing repaints when the user later opens Drafts in a stale tab either.

## Fix (frontend only — 1 file)

Edit `src/routes/_authenticated/operational/semester-upload.tsx`, `saveMut.onSuccess`:

1. Invalidate the keys the Drafts page actually reads:
   - `["semester-drafts"]` (matches `["semester-drafts", deptId]` by prefix)
   - keep `["trainer-load"]` and `["schedules"]`
2. Improve the toast: success message includes a **“View in Active Drafts”** action that calls `navigate({ to: "/operational/drafts" })`. Keeps the builder open so the DH can add more sessions, but gives a one-click path to confirm the draft landed.
3. Bump the in-page “Draft session counter” as today (already in place).

No backend, schema, or RLS changes — the DRAFT rows are already inserted correctly; this is purely a cache-invalidation + UX wiring bug.

## Acceptance
- Save as Draft → toast “Saved N draft session(s) — View in Active Drafts”.
- Clicking the toast action lands on `/operational/drafts` with the new week chips visible immediately under **Active Drafts** (no manual refresh).
- Opening Drafts in another tab/route after saving also shows the new draft on next mount (already worked; now also live-refreshes if Drafts is already open thanks to the existing realtime channel).
- Submit-for-Approval flow is unchanged.
