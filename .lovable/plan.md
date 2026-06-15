## Goal

Clicking **Open chat** on `/operational/drafts` currently throws the user into the global "This page didn't load" fallback, which means a synchronous render error inside `WeekFeedbackWorkspace` is escalating to the router's `defaultErrorComponent`. Fix the crash, contain future failures so the Drafts page itself stays usable, and surface the underlying error to the console for any remaining issues.

## What to change

### 1. Contain the failure (so the whole page never disappears again)

`src/routes/_authenticated/operational/drafts.tsx`
- Wrap the `<WeekFeedbackWorkspace />` invocation in a small local `ErrorBoundary` (class component, ~20 lines) that:
  - Catches render errors thrown anywhere inside the Sheet.
  - Renders a compact inline fallback inside the Sheet ("Couldn't open this week's workspace — refresh to retry") and logs the real error to `console.error` so it shows up in browser dev tools.
  - Closes cleanly when `onOpenChange(false)` runs.
- This guarantees the Drafts page itself keeps rendering its cards, week tiles, and feedback list even if the workspace crashes.

### 2. Fix the most likely crash sources in `src/components/week-feedback-workspace.tsx`

These are the places that can throw synchronously on first render — they will be hardened so the chat opens reliably:

**A. Radix `Select` value handling in `EditRow`** — Radix Select crashes when controlled with an empty string. Initialize venue/trainer state with `row.venue_id ?? undefined` / `row.trainer_registry_id ?? undefined` and pass `value={venueId || undefined}` / `value={trainerId || undefined}` to `<Select>`. (Today they default to `""`, which can throw "A <Select.Item /> must have a value prop…" depending on data.)

**B. Sheet a11y wrapper** — wrap the `sr-only` title in a real `SheetHeader` + add a `SheetDescription` so Radix Dialog's strict-mode a11y check never throws "DialogContent requires a DialogTitle/Description" on certain code paths.

**C. Defensive optional chaining**
- `aggregateStatus`: guard against `rows` being `undefined` (the query starts in `pending`).
- `EditorPanel`: guard `venues ?? []` and `deptTrainers ?? []` already exist; also guard `me?.roles?.includes?.("DH")` — keep as-is but pass `isDH={!!isDH}` from the parent so the editor panel never sees `undefined`.
- `ChatPanel`: when `data` is still loading, render a small "Loading conversation…" placeholder instead of going straight into the message list / textarea logic (avoids reading `data!.thread!.id` in any edge case).

**D. Make `useEffect` for the realtime channel resilient** — only subscribe when `data?.thread?.id` exists (already true), but also drop the channel synchronously when `semesterId` / `weekNum` change, not just on unmount.

### 3. Diagnostic logging

In the new `ErrorBoundary.componentDidCatch`, also send the error message to `toast.error("Workspace error: <message>")` so the user sees an explicit reason instead of the generic "Something went wrong on our end".

## What is NOT changing

- No DB / RLS / RPC / server-function changes.
- No edits to `feedback.functions.ts`, `semester-drafts.functions.ts`, audit logs, notifications, or the resubmit workflow.
- No changes to the entry points (`drafts.tsx` thread list, week tile grid, `matrix.tsx`, `index.tsx`) beyond wrapping the Sheet in the new `ErrorBoundary`.

## Files touched

- **Updated** `src/routes/_authenticated/operational/drafts.tsx` — add local `ErrorBoundary`, wrap `WeekFeedbackWorkspace`.
- **Updated** `src/components/week-feedback-workspace.tsx` — Select value hardening, SheetHeader + SheetDescription, loading states, defensive guards.

## Verification

1. Typecheck/build clean.
2. With Playwright (in build mode): navigate to `/operational/drafts` as a DH, click a **Week N** tile and an **Open chat** entry. Confirm the Sheet opens with both Chat and Edit timetable panels visible, no console exceptions, and the Drafts page underneath remains intact.
3. Confirm that if a transient error is forced (temporarily throw in `WorkspaceBody`), the inline fallback appears inside the Sheet and the rest of the Drafts page stays interactive.

## Open question

If the crash persists after these fixes, the next step is to read the exact `console.error` message that the new `ErrorBoundary` logs and patch the specific call site it points at — please share the console output if so.
