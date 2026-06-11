# Weekly Approvals — Professional Redesign

Replace the current card-grid week list on **Strategic → Approvals → Sessions** with a structured, table-driven workflow matching the reference mockup. Scope is UI/UX only; no schema, RPC, or server-function changes.

## What changes

### 1. Page header
- Rename heading to **"Approvals — Weekly Status"** (Sessions tab body).
- Remove the existing Sessions/Semesters tabs from the visual top — replace with a single segmented control (Weekly Sessions · Semesters) styled as a subtle inline switch, so the Weekly view feels like the primary workflow.

### 2. Filter bar (replaces the dept dropdown card)
A single clean row with two clearly labeled filters:
- **Filter by Academic Session** — Select bound to `listSemesters` (already loaded elsewhere; re-use). Defaults to current/most recent.
- **Filter by Department** — Select bound to `listDeptsWithPendingSessions`, with `(N pending)` count suffix retained.
- Persist both selections to `localStorage` (`approvals.semesterId`, `approvals.deptId`).

### 3. Weekly Status table (core change)
Replace the `grid grid-cols-2…` card grid with a real `<Table>`:

| Column | Content |
|---|---|
| Week | `Week N` with `(Current)` chip on the active week |
| Dates | `Sep 11 – Sep 17` (derived from week_num + semester start_date) |
| Sessions Total | numeric count |
| Approval Status | colored status badge (see below) |
| Actions | contextual button cluster |

**Status badge mapping** (derived from existing week data — `pending`, `total`, plus a new lightweight aggregate the page already has via `weeks`):
- `Approved` → green (`bg-emerald-100 text-emerald-700`) — all sessions live/approved
- `Pending Master` → amber (`bg-amber-100 text-amber-800`) — `pending > 0`
- `Draft (Trainer)` → neutral grey — DH hasn't submitted yet
- `Rejected` → red — at least one rejected session

**Action cluster** (contextual, matches reference):
- Always: `View Details` (opens existing week timetable dialog)
- When `Pending Master`: `Send Back` + `Approve Week`
- When `Approved`: `Un-Approve` (disabled with tooltip "Already live — contact admin" — wires to existing decideWeek with `rejected` only if business allows; otherwise keep disabled placeholder, no new RPC)
- When `Draft (Trainer)`: both action buttons disabled with tooltip "Awaiting DH submission"

All buttons use shared `ApprovalActions` semantics: Approve fires `decideWeek` with `approved`; Send Back opens the canonical `RejectFeedbackDialog` (required message).

### 4. Pagination
- Footer row with `Previous` / `Next` and `Page X of Y`.
- Default 10 weeks per page; show all weeks of the semester (currently the API only returns pending — extend query to return all weeks with rollup status, or fall back to paging the returned set).

### 5. Empty states
Keep the `EmptyState` component but render it as a single full-width row inside the table body (`colSpan={5}`) when no weeks match.

### 6. Visual polish
- Sticky table header, zebra striping (`even:bg-muted/20`), row hover (`hover:bg-accent/30`).
- Status badges use rounded-full pill style, matching reference.
- Tighter row height (`h-12`), action buttons `size="sm"` with consistent gap.
- Card wrapper around the table with `rounded-2xl border` for the elevated look in the mockup.

## Out of scope
- No DB migrations, no new RPCs, no changes to `decideWeek`/`decide_approval`.
- Semesters tab unchanged.
- DH-side drafts page unchanged.
- No new design tokens; reuse existing semantic colors (add the emerald/amber utility classes inline only where status badges need them, since destructive/secondary alone don't cover the 4-state palette).

## Files touched
- `src/routes/_authenticated/strategic/approvals.tsx` — rewrite `SessionApprovalsByDeptWeek` to use Table layout, add academic-session filter, add status derivation + pagination.
- `src/lib/approvals.functions.ts` — extend `listPendingWeeksForDept` (or add a sibling `listAllWeeksForDept`) to return ALL weeks of the chosen semester with `{week_num, total, pending, approved, rejected, draft, start_date, end_date}` so status can be rendered for every row (read-only query — no schema change).

## Question before I build
The reference shows an **"Un-Approve"** action on already-approved weeks. The current backend has no "un-approve" RPC and approved sessions become LIVE. Want me to (a) render Un-Approve as disabled-with-tooltip for now (safe, no backend work), or (b) skip the column entirely for approved weeks?
