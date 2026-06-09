# Unified Enterprise UI/UX — Somali Regional State Jigjiga Polytechnic College

Scope: **presentation only**. No backend, RLS, RPC, route, or workflow changes. All existing data hooks, queries, mutations, realtime channels, and approval logic stay byte-identical. Only JSX, CSS tokens, and a few new pure-presentation components are added.

## 1. Global Design System

**`src/styles.css`** — extend semantic tokens (no overrides of existing ones):
- `--brand-name`, `--brand-short` documented in a header comment.
- Add neutral surface scale: `--surface-1`, `--surface-2`, `--surface-3` for ERP-style card stacking.
- KPI accent tokens already exist (`--stat-blue/green/purple/orange`, `--emerald/amber/rose/teal`) — keep, document usage.
- Typography scale via utility classes: `.text-display`, `.text-h1`, `.text-h2`, `.text-section`, `.text-meta` (tracking + weight presets).

**New shared presentation components** (`src/components/erp/`):
- `app-header.tsx` — page title, role chip, breadcrumbs (auto from `useRouterState`), global search slot, `NotificationsBell`, quick-actions slot. Drop-in for every shell.
- `kpi-card.tsx` — icon, label, value, trend (▲/▼ + delta + period), color variant (`blue|green|purple|orange|emerald|amber|rose|teal`), loading skeleton.
- `kpi-grid.tsx` — responsive 1/2/4-col grid.
- `section-card.tsx` — titled card with optional action slot, description, footer.
- `data-table.tsx` — thin wrapper around existing `Table` adding standard toolbar: search input, filter slot, sort menu, pagination (10/25/50), export button slot, bulk-action slot, status-badge helpers. Pure presentation; consumers pass rows already filtered/sorted via existing logic OR opt into built-in client-side filtering through a `columns` config.
- `status-badge.tsx` — normalized badges for `DRAFT|PENDING|APPROVED|REJECTED|FEEDBACK_ACTIVE|LIVE|COMPLETED|CANCELLED`.
- `activity-timeline.tsx` — vertical timeline (icon + title + meta + time) backed by existing audit/notification data already fetched.
- `workflow-widget.tsx` — horizontal stepper for approval lifecycle.
- `empty-state.tsx` — illustration slot (lucide icon in tinted circle), title, description, primary action slot. Replaces all bare "No data" strings.
- `page-shell.tsx` — wraps content with consistent padding, max-width, and section spacing.

The Approval Queue toolbar built last cycle is **kept as-is** and becomes the reference; `data-table.tsx` is extracted from it without changing its behavior.

## 2. Brand & Shell

- `src/components/strategic/strategic-shell.tsx`, `src/routes/_authenticated/operational.tsx`, `src/routes/_authenticated/ground.tsx`: header gets the full college name "Somali Regional State Jigjiga Polytechnic College" with role label ("Master Admin" / "Department Head" / "Trainer") underneath, plus breadcrumbs and `NotificationsBell`. Sign-out stays.
- Sidebar (strategic) — keep nav, restyle active state, add a brand block at top with college name + short ERP tag.

## 3. Master Admin Dashboard (`src/routes/_authenticated/strategic/index.tsx`)

Re-layout existing queries only (no new data fetches beyond what's already wired):
- Top: 4 KPI cards using **existing data already loaded** — Pending Approvals, Active Semesters, Conflicts, Departments.
- Row 2: `section-card` "System Health" (uses current ping/queries) + `section-card` "Approval Workflow" (workflow-widget summarizing pending → approved/rejected counts).
- Row 3: "Recent Activity" timeline from existing `audit_logs` query already used on `/strategic/audit`, scoped to last 10.
- Row 4: "Quick Actions" grid of links to approvals/modules/users/semesters.

## 4. Department Head Dashboard (`src/routes/_authenticated/operational/index.tsx`)

- KPI strip: Weekly Drafts, Pending Approval, Active Conflicts, Trainers in Dept.
- "Semester Progress" section-card with progress bar from existing semester data.
- "Approval Queue Summary" — small table reusing existing draft list query.
- "Trainer Workload" — bar list from existing workload data.
- "Feedback Requests" — list from `schedule_feedback_threads` already fetched.

## 5. Trainer Dashboard (`src/routes/_authenticated/ground/index.tsx`)

Keep existing `getTrainerToday` / `getMyProgress` / `getTrainerSessionsDetailed` and the Today/Upcoming dialog (already working) — restyle around them:
- Hero KPI row: Today, Done/Target, Upcoming, Attendance %.
- "Today's Schedule" — professional timetable cards (course, time, room, section) replacing the current minimal rows. Keep the same `<Link>` to `/ground/$scheduleId`.
- "This Week" — calendar-style strip (Mon–Sun) with session dots from existing detailed query (scope expanded to week client-side; no new server fn).
- "Alerts" — pulls from existing notifications.
- Empty states use `empty-state` component.

## 6. Tables Standardization

Apply `data-table` wrapper to these list pages (header/toolbar only, row rendering and mutation handlers untouched):
- `/strategic/modules`, `/strategic/users`, `/strategic/trainers`, `/strategic/students`, `/strategic/sections`, `/strategic/venues`, `/strategic/levels`, `/strategic/semesters`, `/strategic/departments`, `/strategic/department-heads`, `/strategic/audit`.
- `/operational/students`, `/operational/attendance`, `/operational/matrix`, `/operational/reports`.
- `/strategic/approvals` — **not modified** (already canonical).

For each page: search box, status filter (where status exists), sort menu, pagination, export-CSV button reusing existing export functions where present.

## 7. Timetable Pages

- `/operational/drafts` and `week-timetable-dialog`: keep DH edit/delete and conflict badges from last cycle. Add a calendar grid view toggle (Day / Week) above the existing list — pure render of the same rows in a grid by `day_of_week × time_slot`. No new queries.
- `/operational/live-monitor`: card grid grouped by venue with status badges.

## 8. Empty States

Replace bare "No data" text in all list pages and dashboards with `empty-state`: lucide icon, helpful copy, primary action (e.g. "Upload semester", "Add module").

## 9. Out of scope (explicitly untouched)

- All `*.functions.ts` server functions.
- All RLS, RPCs, migrations.
- Realtime channels.
- Approval/feedback/resubmit workflow logic.
- Auth, role gating, route tree.
- `src/integrations/supabase/*` auto-generated files.
- `src/routes/_authenticated/strategic/approvals.tsx` (already canonical from last cycle).
- `src/components/week-timetable-dialog.tsx` edit/delete/conflict logic (only visual polish around it).

## Technical notes

- All new components live under `src/components/erp/` and use only existing semantic tokens — no hardcoded colors.
- `data-table` accepts either pre-rendered children (legacy) or a `columns` + `rows` config for new usage, so migration is incremental within this single cycle without touching mutation code.
- Breadcrumbs derived from `useRouterState().location.pathname` mapped against a small static label dictionary in `app-header.tsx`.
- Calendar week strip on trainer dashboard computes Mon–Sun from `new Date()` client-side; consumes existing `getTrainerSessionsDetailed({ scope: "upcoming" })` filtered to the current ISO week.
- No new npm dependencies.

## Files to be added
- `src/components/erp/app-header.tsx`
- `src/components/erp/kpi-card.tsx`
- `src/components/erp/kpi-grid.tsx`
- `src/components/erp/section-card.tsx`
- `src/components/erp/data-table.tsx`
- `src/components/erp/status-badge.tsx`
- `src/components/erp/activity-timeline.tsx`
- `src/components/erp/workflow-widget.tsx`
- `src/components/erp/empty-state.tsx`
- `src/components/erp/page-shell.tsx`
- `src/components/erp/week-calendar-strip.tsx`

## Files to be edited (presentation only)
- `src/styles.css` (additive tokens + utility classes)
- `src/components/strategic/strategic-shell.tsx`
- `src/routes/_authenticated/operational.tsx`
- `src/routes/_authenticated/ground.tsx`
- `src/routes/_authenticated/strategic/index.tsx`
- `src/routes/_authenticated/operational/index.tsx`
- `src/routes/_authenticated/ground/index.tsx`
- The list/table routes in §6 (toolbar wrap + empty states only)
- `src/routes/_authenticated/operational/drafts.tsx` (add calendar-grid view toggle)
- `src/routes/_authenticated/operational/live-monitor.tsx` (visual restyle)
