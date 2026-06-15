## Goal

Turn the existing TVET ERP into a live, event-driven system where every dashboard, report, and metric is derived from the database in real time, exports are first-class, and every business action is auditable. No existing functionality, RLS, or auth changes.

## 1. Realtime sync layer (database + client)

**Migration — enable Realtime on the agreed tables:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.schedules,
  public.approval_queue,
  public.attendance_logs,
  public.session_logs,
  public.attendance_overrides,
  public.students,
  public.trainer_registry,
  public.modules;
ALTER TABLE public.schedules, public.approval_queue, public.attendance_logs,
            public.session_logs, public.attendance_overrides, public.students,
            public.trainer_registry, public.modules REPLICA IDENTITY FULL;
```

**New client primitive — `src/hooks/use-live-tables.ts`:**
One channel per mounted hook, subscribes to `postgres_changes` for the requested tables, and on any event calls `queryClient.invalidateQueries({ queryKey: [scope] })` for the affected scopes (debounced 250ms to coalesce bursts). Replaces ad-hoc polling and supplements `use-dh-live-channel.ts` (kept for backward compat).

**Wiring:** mount `useLiveTables([...])` at the top of each dashboard / list route:

- Operational dashboard, drafts, matrix, attendance, live-monitor, students → schedules, approval_queue, attendance_logs, session_logs, attendance_overrides.
- Strategic dashboard, approvals, students, trainers, modules, audit → schedules, approval_queue, students, trainer_registry, modules.
- Approvals page → approval_queue + schedule_feedback_messages (already broadcast-friendly).

Result: any submit/approve/check-in/override pushes updates to every open client within ~1s with no manual refresh, while keeping the cache as the single source of truth.

## 2. Unified live report engine

**New module — `src/lib/reports.functions.ts`** (server functions, RLS-scoped via `requireSupabaseAuth`). One handler per report; all accept a shared filter shape:

```ts
type ReportFilters = {
  academic_year?: string;     // derived from semester_registry.start_date year
  semester_id?: string;
  department_id?: string;
  trainer_registry_id?: string;
  module_id?: string;
  date_from?: string; date_to?: string;
  status?: string;
};
```

Reports (all derived live from current rows, no caching):

- Academic: `enrollment`, `attendanceSummary`, `trainerWorkload`, `timetableUtilization`, `semesterProgress`, `completionStatus`.
- Department: `departmentPerformance`, `trainerPerformance`, `attendanceCompliance`, `approvalStatus`, `activeSessions`.
- Admin: `institutionSummary`, `academicStatistics`, `departmentRankings`, `userActivity`, `auditActivity`, `complianceSummary`.
- Approvals: `approvalReport` (pending/approved/returned/rejected with the same filters).

**URL-driven filters — `src/routes/_authenticated/{operational,strategic}/reports.tsx`:**
Refactor to a single tabbed report shell using `validateSearch` + `zodValidator` + `fallback()` so every filter (year/sem/dept/trainer/module/range/status/tab) lives in the URL. Filter bar uses existing shadcn Select / DatePicker. Loader uses `ensureQueryData(reportsQueryOptions(deps))`; component reads via `useSuspenseQuery`. Changing a filter rewrites search params; `useLiveTables` triggers refetch on data changes.

**Drill-downs:** every row in a report links to the underlying list route with the same filters preserved in search params (matches the existing dashboard drill-down behavior).

## 3. Export engine (PDF + Excel + Print)

Add three deps: `xlsx`, `jspdf`, `jspdf-autotable`.

**New helpers — `src/lib/report-export.ts` (client-only):**

- `exportToXlsx(name, columns, rows)` — SheetJS workbook with one sheet per report section, branded header row, frozen header, autosized cols.
- `exportToPdf(name, title, filters, columns, rows)` — jsPDF + autotable with institution name header, filter summary, page numbers, landscape A4.
- `openPrintView(reportKey, searchString)` — opens `/print/{reportKey}?...` in a new tab.

**Existing CSV** (`exports.functions.ts`) stays; the unified Export menu on every report exposes CSV / Excel / PDF / Print.

**Print routes — `src/routes/print/$report.tsx`:**
Standalone, no shell, `@media print` styles already in `styles.css`. Reuses the same server fns so print output equals on-screen data.

## 4. Live dashboard fixes

Replace any remaining static values:

- Operational + Strategic dashboards: replace any constant in `dashboard.functions.ts` that doesn't query the DB. Audit pass — every KPI must reference `schedules`, `approval_queue`, `attendance_logs`, `students`, `trainer_registry`, or `modules` directly.
- Mount `useLiveTables` so KPI tiles, alert rows, and activity rows refresh automatically.
- `notifications-bell.tsx`: switch from poll to `useLiveTables(["notifications"])` using existing query key.

## 5. Data consistency validators

**Server fn — `src/lib/consistency.functions.ts`** (`runConsistencyCheck`, MA-only). Compares aggregates:

- `students` count per department vs `departments.student_count` (if stored) and per `sections`.
- `attendance_logs` totals vs schedule-level rollups used in KPIs.
- `approval_queue` pending count vs dashboard counter.
- Schedules with no trainer, no venue, or no module.

Returns `{ checks: [{ name, expected, actual, ok, drift }] }`. Surface on `strategic/system-data` under a new "Data Integrity" card with a "Run check" button; failed checks render as warning rows and write to `audit_logs` (`action_type='CONSISTENCY_CHECK'`).

## 6. Auditable business events

Audit coverage is already strong for approvals/swaps/deletes. Add missing events via lightweight wrappers in the relevant server fns:

- `EXPORT_REPORT` — written when any export server fn runs (report key + filters).
- `RUN_REPORT` — written when a report is generated (cheap, used for `userActivity`).
- `STUDENT_ADDED` / `STUDENT_UPDATED` / `STUDENT_DELETED` — in `students.functions.ts`.
- `TRAINER_UPDATED`, `MODULE_UPSERT` — in their CRUD fns.
- `RESET_REPORT_FILTERS` is intentionally NOT logged (UI-only).

All entries go through the existing `audit_logs` insert pattern (`actor_id`, `action_type`, `entity_type`, `entity_id`, `before_state`, `after_state`).

## 7. Acceptance check

- Open two browsers as DH + MA: DH submits, MA sees pending count + new row within ~1s, no refresh.
- Trainer checks in on `/ground/$id` → operational dashboard "Active Classes" + attendance KPI updates without action.
- Change a filter on Reports → URL updates, data updates, browser back restores prior view.
- Export PDF/Excel of `attendanceSummary` filtered by department + date range → file contains the exact rows shown on screen.
- Consistency check on `system-data` → 0 drift on a fresh seed; corrupting a row surfaces it.
- All previous routes/buttons still work; no RLS or schema change touches existing tables besides the publication add.

## Files

**New:**
- `supabase/migrations/<ts>_realtime_publication.sql`
- `src/hooks/use-live-tables.ts`
- `src/lib/reports.functions.ts`
- `src/lib/consistency.functions.ts`
- `src/lib/report-export.ts`
- `src/routes/print/$report.tsx`
- `src/components/reports/report-filter-bar.tsx`
- `src/components/reports/export-menu.tsx`

**Edited (UI/wiring only, no behavior regressions):**
- `src/routes/_authenticated/operational/{index,reports,drafts,matrix,attendance,live-monitor,students}.tsx`
- `src/routes/_authenticated/strategic/{index,reports,approvals,students,trainers,modules,audit,system-data}.tsx`
- `src/components/notifications-bell.tsx`
- `src/lib/dashboard.functions.ts` (replace any static value with DB-derived)
- `src/lib/students.functions.ts`, `src/lib/trainer.functions.ts`, `src/lib/modules.functions.ts` (add audit log inserts)
- `package.json` (add `xlsx`, `jspdf`, `jspdf-autotable`)

## Explicitly NOT touched

Auth, RLS policies, existing RPC bodies, semester/draft/approval workflows, `client.ts`/`client.server.ts`/`auth-middleware.ts`/`auth-attacher.ts`, `types.ts`, prior migrations.
