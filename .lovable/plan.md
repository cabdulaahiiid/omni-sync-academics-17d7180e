# Finish remaining UI/UX — Strategic Students & Audit Logs

## Context

The 2026 Command Center redesign is otherwise complete (sidebars, dashboards, approvals, drafts, attendance, deep-links, personalization, badges all done). A scan of `src/routes` for "Coming in the next iteration" / "Not yet implemented" turns up exactly **two true placeholders** still shipping the boilerplate "ships in the next phase" card:

- `src/routes/_authenticated/strategic/students.tsx`
- `src/routes/_authenticated/strategic/audit.tsx`

All other routes already have real implementations. Per the rules, completed screens stay locked.

## Scope (only these two files)

### 1. Strategic → Students (institution-wide directory)

Build a read-only MA-scope student directory that mirrors the look of the existing strategic pages (Trainers, Users, Departments).

Data source — reuse what already exists, **no new server fns or migrations**:
- `listMyStudents` from `@/lib/students.functions` (already returns all students when caller is MA)
- `listDepartments` from `@/lib/data.functions` for the department filter

UI:
- Page header (`text-2xl font-semibold tracking-tight` + muted subtitle) matching other strategic pages.
- KPI strip using the existing `KpiTile` component: Total Students, Departments Represented, Levels Active, Sections Active (all derived client-side from the list).
- Filter bar: search input (name / registration number), Department `Select`, Level `Select`, Section `Select`, Status `Select` (active/inactive) — all client-side filtering over the already-fetched list.
- Results `Card` with `Table` (Reg #, Full Name, Department, Level, Section, Status badge). Loading skeleton rows while `isLoading`. Empty state via existing `EmptyState` component when zero results.
- Pagination (client-side, 25/page) using existing `Pagination` ui component.
- No create/edit/delete actions on the MA view (DH owns roster CRUD on `/operational/students`).

### 2. Strategic → Audit Logs

Build a real audit viewer for MA.

Data source — reuse `listRecentAuditLogs` from `src/lib/data.functions.ts` (returns last 20). To support filters + a "Load older" button without backend changes, add a sibling client query that hits `supabase.from("audit_logs").select(...)` directly (the existing function does the same thing; RLS already protects it). No new server fn, no migration.

UI:
- Page header matching other strategic pages.
- KPI strip: Events (last 24h), Events (last 7d), Distinct Actors (7d), Top Action Type (7d) — derived from fetched rows.
- Filter bar: search (entity_id / actor_id), Action Type `Select` (distinct values from data), Entity Type `Select`, date-range preset chips (24h / 7d / 30d).
- Activity feed `Card` reusing existing `ActivityRow` component (`src/components/erp/activity-row.tsx`) so the styling matches the dashboard live-feed exactly. Each row: action type badge, entity, actor (short id), relative time + absolute timestamp on hover.
- "Load more" button increments page size by 50.
- Loading skeleton rows; `EmptyState` when no matches.

## Non-Goals

- No changes to any other route, component, shell, store, server function, or migration.
- No new design tokens, no theme tweaks, no navigation changes.
- No CRUD on students or audit logs from these views (audit is append-only by design).
- No new dependencies.

## Files Touched

- `src/routes/_authenticated/strategic/students.tsx` (rewrite placeholder → real page)
- `src/routes/_authenticated/strategic/audit.tsx` (rewrite placeholder → real page)

## Verification

- Build passes (harness runs typecheck automatically).
- Manually visit `/strategic/students` and `/strategic/audit` in the preview, confirm data loads, filters work, pagination/load-more works, empty state renders when filters exclude everything.
- Confirm no other route file was modified (`git diff --stat` will only show the two files above).
