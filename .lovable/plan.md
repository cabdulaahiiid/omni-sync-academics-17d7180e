# TVET ERP Dashboard Redesign — Master Admin & Department Head

Fluent / Dynamics 365 visual direction. Sidebar untouched. UI restyle + targeted read-only server functions. All drill-downs deep-link to existing routes with URL search params; no new pages.

## Files touched

**New / extended server functions** (`src/lib/ma.functions.ts`, `src/lib/dh-ops.functions.ts`):
- `getStrategicStatsExt` — extends `getStrategicStats` with: pending approvals (`approval_queue.decision='pending'`), attendance % today, geo compliance 7d, departments-reporting count (depts with ≥1 schedule today), trend deltas vs. 7-day prior.
- `getApprovalQueueSummary` — `{pending, approved_today, returned, rejected}` counts from `approval_queue`.
- `getInstitutionActivity` — `{active_classes, completed_today, missing_attendance, late_attendance, schedule_submissions_today}` from `schedules` + `session_logs` + `attendance_logs`.
- `listCriticalAlerts` — union of: schedules with `status=LIVE` past `end_time` without `session_logs.submitted_at`; trainer leave gaps overlapping today's schedules; pending-approval count; conflict flags from `approval_queue`.
- `getDepartmentPerformance` — per-department: attendance %, schedule-completion %, submission compliance %, trainer punctuality (proxy on `checkin_at` vs `start_time`).
- `getWeeklyApprovalSeries` — 8-week window: submitted, approved, rejected counts grouped by ISO week from `audit_logs` + `approval_queue`.
- `listLiveActivityFeed` — merges `audit_logs` recent 20 + last 10 `session_logs` + last 10 `attendance_logs` rollups into a unified, clickable timeline.
- `getDHStatsExt` — extends `getDHStats`: active classes today, dept attendance %, pending schedule reviews (DRAFT/PENDING_MA), submitted vs missing attendance today, weekly compliance.
- `listDHScheduleCommand` — current-week schedules joined with section, course, trainer, status, attendance status.
- `listDHActiveClasses` — schedules where `status='ACTIVE'` OR (`status='LIVE'` AND now within window).
- `listDHAttendanceMonitor` — today: submitted / missing / late buckets with schedule ids for drill-down.
- `getDHAnalytics` — 8-week attendance trend, punctuality trend, completion trend for the DH's department.
- `listDHAlerts` — missing attendance, late trainers (checkin_at > start_time + 15m), schedule conflicts, unreviewed drafts.

All new fns use `requireSupabaseAuth`; MA fns gate on `has_role(uid,'MA')`, DH fns on `current_department_id()` to enforce dept scope.

**Redesigned routes**:
- `src/routes/_authenticated/strategic/index.tsx` — Strategic Command Center (rebuilt per layout below).
- `src/routes/_authenticated/operational/index.tsx` — Department Operations Center (rebuilt).
- `src/routes/_authenticated/strategic/approvals.tsx` — restyle header, filter bar, and KPI strip only; keep WeeklyStatusTable + logic unchanged.

**New shared components** (`src/components/erp/`):
- `kpi-tile.tsx` — Fluent-style large tile: label, value, delta chip, sparkline, "last updated" timestamp, click target.
- `dashboard-section.tsx` — Sticky section header with title + actions.
- `alert-row.tsx` — Severity icon, message, "Open records →" link.
- `activity-row.tsx` — Unified timeline row with action chip, entity link, timestamp.

**Search-param contracts on existing routes** (read-only additions; no behavior change when absent):
- `/strategic/approvals?status=pending|returned|approved&dept=<id>&week=<n>`
- `/strategic/audit?action=<type>&entity=<type>&from=<iso>`
- `/strategic/insights?metric=attendance|punctuality|geo&dept=<id>`
- `/strategic/departments/$id?tab=performance|reporting`
- `/operational/live-monitor?status=active|missing|late`
- `/operational/attendance?status=submitted|missing|late&date=<iso>`
- `/operational/drafts?status=draft|pending|returned`
- `/operational/reports?metric=attendance|punctuality|completion`

Each consuming route adds `validateSearch` with `zodValidator` + `fallback`, then filters its existing query. No SQL changes — all filtering is client/server-fn level on data already returned.

## Strategic Command Center layout

```
[ Sticky header: title • semester selector • "Last updated 12:04" • refresh ]
[ Row 1: 6 KPI tiles ───────────────────────────────────────────────────── ]
  Active Sessions │ Pending Approvals │ Attendance Rate
  Trainer Punctuality │ Geo Compliance │ Departments Reporting
[ Row 2: 3-col operational control ──────────────────────────────────────── ]
  Approval Queue Summary │ Institution Activity Monitor │ Critical Alerts
  (Pending/Approved Today/  (Active/Completed/Missing/    (real rows; click
   Returned/Rejected;        Late/Submissions; each       opens filtered
   each clickable)           clickable)                    route)
[ Row 3: Analytics ──────────────────────────────────────────────────────── ]
  Department Performance (bar/grid, click dept → /strategic/departments/$id)
  Weekly Approval Analytics (8-wk stacked bar, click week → approvals?week=N)
[ Row 4: Quick Actions strip ────────────────────────────────────────────── ]
  Approvals · Audit · Insights · Users · Departments · Settings
[ Row 5: Live Activity Feed (unified, clickable) ────────────────────────── ]
```

Realtime: existing `audit_logs` + `schedules` channels stay; add `attendance_logs` channel to invalidate KPI queries on insert.

## Department Operations Center layout

```
[ Sticky header: dept name • week selector • refresh ]
[ Row 1: 6 KPI tiles ───────────────────────────────────────────────────── ]
  Active Classes Today │ Dept Attendance Rate │ Pending Schedule Reviews
  Submitted Attendance │ Missing Attendance   │ Weekly Compliance
[ Row 2: Schedule Command Center ────────────────────────────────────────── ]
  Left: table (Week/Trainer/Course/Section/Schedule Status/Attendance Status)
        — row select drives right detail panel (no navigation)
  Right: action panel (Review / Approve / Return / View Timetable)
[ Row 3: Live Monitoring (2 cols) ───────────────────────────────────────── ]
  Active Classes list │ Attendance Monitoring (Submitted/Missing/Late)
[ Row 4: Department Analytics ───────────────────────────────────────────── ]
  Attendance Trend │ Trainer Punctuality │ Schedule Completion
  (click point → /operational/reports?metric=…&date=…)
[ Row 5: Department Alerts ──────────────────────────────────────────────── ]
  Missing Attendance · Late Trainers · Conflicts · Unreviewed Drafts
```

Row 2 right panel reuses existing `dhRequestApprovalPerWeek` / `decideWeek` / week-timetable-dialog wiring. "Approve / Return" buttons call existing `dh_submit_semester_per_week` / `dh_resubmit_week` RPCs through the existing `dh.functions.ts` wrappers.

## Visual system (Fluent / Dynamics 365)

- Surfaces: existing `--card` / `--border` tokens; add `--surface-raised` (one notch lighter) for KPI tiles, `--surface-sunken` for table headers. No new color hex values — derive via `color-mix` from existing `--stat-*` tokens.
- Type: keep current font; KPI value `text-[28px] font-semibold tracking-tight`; labels `text-[11px] uppercase tracking-[0.08em] text-muted-foreground`.
- Density: row height 44px in tables, 12px section gaps, sticky header with bottom border + subtle shadow on scroll.
- Status pills: reuse existing `StatusPill` from approvals redesign (emerald / amber / muted / rose).
- Delta chip: green up-arrow / red down-arrow with % vs 7-day prior; neutral when no comparison data.
- "Last updated" timestamp from React Query's `dataUpdatedAt`.
- Mobile: KPI grid collapses 6→2 cols; Row 2/3 stack; Schedule Command Center splits into accordion (table → detail).

## Real-data guarantees

Every tile/row/chart sources from a server function listed above. If a metric has no source row yet (e.g. no `session_logs` today), the tile shows `0` with empty-state copy "No activity yet today" — not a placeholder number. The current `trainer_punctuality = geoPct` proxy is replaced by an actual `checkin_at` vs `start_time` calculation in `getStrategicStatsExt`.

## Out of scope

- No sidebar changes, no new routes, no schema migrations, no new RPCs.
- Existing approvals table body, DH drafts page, semester upload, students hub, audit page, insights page — untouched (only deep-link search params honored when present).
- No mocked or decorative numbers anywhere.
