## Goal

Convert `/operational/drafts` into a 4-quadrant "Single-Pane-of-Glass" Schedule Manager so the DH manages the entire timetable lifecycle (Draft → Pending → Feedback → Approved) without leaving the page. Approvals already flow server-side via `decide_approval` / `ma_decide_week` (status flips to `LIVE` + `is_published=true`); the realtime channel already invalidates on `schedules` and `semester_registry` changes, so the "state-driven automation" surfaces automatically once the UI buckets by status.

## Scope (single page, frontend-only)

File touched: `src/routes/_authenticated/operational/drafts.tsx` only. No DB, RPC, or server-fn changes — the existing `listSemesterDrafts` already returns per-week counts (`total`, `pending`, `published`) which is enough to derive every bucket. Existing realtime subscription stays; it already invalidates the query on any schedule/semester/feedback change so an admin approval auto-moves a week from Pending → Approved without user action.

## Bucketing rules (per semester+week)

Each semester row from `listSemesterDrafts` exposes weeks with `{ total, pending, published }`. Derive status per week:

- **Approved** — `published === total` (every session in week is LIVE)
- **Pending** — `pending > 0`
- **Feedback** — week appears in `weekThreads` (the `listWeekThreadsForDept` result) AND not fully approved
- **Draft** — everything else (`published === 0 && pending === 0`)

A week is rendered in exactly one quadrant based on this priority: Feedback > Pending > Approved > Draft. Semester-level status (`distribution_status`) is shown as a sub-badge inside the relevant card.

## Layout

Replace the current vertical stack with:

```text
┌─────────────────────────┬─────────────────────────┐
│ 1. Drafts               │ 2. Pending Admin        │
│   (h-[45vh], scroll)    │   (h-[45vh], scroll)    │
│   high-contrast accent  │   muted/read-only       │
├─────────────────────────┼─────────────────────────┤
│ 3. Feedback Hub         │ 4. Approved & Current   │
│   destructive border    │   timeline strip on top │
│   (h-[45vh], scroll)    │   (h-[45vh], scroll)    │
└─────────────────────────┴─────────────────────────┘
```

- Outer container: `grid grid-cols-1 lg:grid-cols-2 gap-4`; each card uses `h-[45vh] flex flex-col` with `CardContent` `flex-1 overflow-y-auto`.
- Page wrapper drops outer scrolling for `lg:` and up; on mobile it falls back to single column stacking (the "no vertical scroll" rule only holds for desktop viewports — call this out so the user knows).
- Header row collapses to a compact title + legend strip (one line).

## Quadrants

### Part 1 — Drafts (top-left, high-contrast)
- Card style: `border-primary/40 bg-primary/5`.
- Lists each semester that has any Draft weeks. For each: semester title + `start_date → end_date`, then a grid of Draft-week chips.
- Two semester-level actions (preserved from current page):
  - `[Submit by Week]` → `dhRequestApprovalPerWeek`
  - `[Submit by Semester]` → `requestSemesterApproval`
- Empty state: "No drafts. Upload a semester to get started." with a link to `/operational/semester-upload`.

### Part 2 — Pending Admin Approval (top-right, read-only)
- Card style: `border-amber/40 bg-amber/5`.
- Lists every week chip with amber "Pending" badge. No buttons — click opens the week in `WeekFeedbackWorkspace` (read-only mode is already how it renders without a thread).
- Shows count summary `N week(s) waiting on Admin`.

### Part 3 — Feedback Hub (bottom-left, destructive border)
- Card style: `border-2 border-destructive/60`.
- Driven by `weekThreads` (already fetched). Each row: semester · week, last-message timestamp, `[Open Chat]` button (opens `WeekFeedbackWorkspace`) and `[Resubmit for Approval]` button.
- Resubmit wiring: reuse `dhRequestApprovalPerWeek` (which already promotes DRAFT weeks of that semester to PENDING_MA). For per-week granularity we already have `dh_resubmit_week` RPC exposed via `dhResubmitWeek` in `feedback.functions.ts` — call that with `{ semester_id, week_num }` so only the affected week resets to Pending. On success: toast + the realtime listener auto-removes it from Feedback and adds it to Pending.

### Part 4 — Approved & Current (bottom-right, timeline)
- Card style: `border-emerald/40 bg-emerald/5`.
- Top strip: simple horizontal timeline of the semester's weeks (W1…Wn) with each week dot colored by status (green=approved, amber=pending, red=feedback, grey=draft). Pure CSS dots, no chart lib.
- Body: list grouped by semester (chronological by `start_date` desc — "archive by semester/year"), each with the list of approved week chips. Clicking a week opens the read-only workspace.

## Status badges (shared component)

Add a local helper in the same file:

```ts
const STATUS_PILL = {
  APPROVED:  "bg-emerald/15 text-emerald border-emerald/40",
  PENDING:   "bg-amber/15 text-amber-fg border-amber/40",
  FEEDBACK:  "border-2 border-destructive text-destructive bg-transparent",
  DRAFT:     "bg-muted text-muted-foreground border-border",
};
```

Rendered via the existing `StatusBadge` styling pattern (`rounded-full px-2 py-0.5 text-[10px] uppercase`).

## State-driven automation (already in place — confirm)

The existing realtime channel on `schedules` + `semester_registry` + `schedule_feedback_threads/messages` invalidates the two queries powering all four quadrants. When MA calls `decide_approval` (or `ma_decide_week`) with `approved`, schedules flip to `LIVE`/`is_published=true`, `listSemesterDrafts` refetches, the per-week derivation moves the chip from quadrant 2 → 4 automatically. No new listener needed — note this in code comments so it isn't re-added.

## Performance

- Both queries (`semester-drafts`, `week-feedback-threads`) stay shared at the page level; each quadrant is a memoized child component (`DraftsQuadrant`, `PendingQuadrant`, `FeedbackQuadrant`, `ApprovedQuadrant`) receiving pre-filtered slices via `useMemo`. React only re-renders the two quadrants whose slice referentially changed.
- `WeekFeedbackWorkspace` and `WorkspaceErrorBoundary` mount logic preserved as-is.

## Out of scope

- No DB/RPC/migration changes.
- No edits to `WeekFeedbackWorkspace`, semester upload, or approval engine.
- No mobile-specific redesign beyond column collapse.
- No archive pagination — Approved quadrant scrolls; archival = sort order only.

## Files

- `src/routes/_authenticated/operational/drafts.tsx` — rewrite layout, add 4 memoized quadrant components, wire `dhResubmitWeek` for per-week resubmit, replace badges with pill helper.
