
# SrsTvet Targeted Update — Architecture Plan

## Impact Analysis (components touched)

| Area | Files / surfaces impacted |
|---|---|
| Approvals workflow | `strategic/approvals.tsx`, `lib/ma.functions.ts` (new week-grouped queries) |
| Department dashboard | `strategic/departments.tsx` (list mode), new `strategic/departments.$id.tsx` (detail) |
| Trainer mobile flow | `ground/index.tsx`, `ground/$scheduleId.tsx`, new check-in/summary steps, reuse `useGeoGatekeeper`, `countdown-timer` |
| Bulk import + templates | new `strategic/imports.tsx`, new `lib/imports.functions.ts`, static `.xlsx` templates under `public/templates/` |
| Documentation package | generated artifacts in `/mnt/documents/` (one .xlsx workbook + 4 template files) |
| Theme | `src/styles.css` token tweak to enterprise blue/white (no component rewrites) |
| State preservation | TanStack Router `search` params for filters + scroll restoration on department list |

No changes to: trainer qualifications editor, sections/levels CRUD, RLS model for existing tables.

---

## 1. Database Changes

Single migration. All additive — no destructive changes.

**`approval_queue`** — already has `type`, `decision`, `submitted_by`. Add:
- `week_num int` (nullable) — for grouping `type='session'` approvals by week. Backfill from `schedules.week_num` via update.

**`schedules`** — no new columns; `week_num` and `semester_id` already exist.

**`attendance_overrides`** / **`session_logs`** — no changes (mobile flow reuses existing tables).

**New table `import_jobs`** (for bulk-import audit + FK validation results):
- `id uuid pk`, `kind text check in ('trainers','students','modules','schedule')`,
- `uploaded_by uuid`, `status text` (`pending|validated|applied|failed`),
- `total_rows int`, `valid_rows int`, `errors jsonb`, `created_at timestamptz`.
- RLS: MA-only ALL.

**Indexes:** `idx_approval_queue_type_decision_week (type, decision, week_num)`,
`idx_schedules_dept_week (department_id, week_num)`.

No new enums. No changes to `auth.*`.

---

## 2. Routing Structure

```text
src/routes/_authenticated/
├── strategic/
│   ├── approvals.tsx           (refactor: dept filter → week selector → actions)
│   ├── departments.tsx         (refactor: clickable list, preserves search params)
│   ├── departments.$id.tsx     (NEW: drill-down with levels/sections/trainers/modules)
│   └── imports.tsx             (NEW: template downloads + upload + FK validation)
├── ground/
│   ├── index.tsx               (refactor: today's schedule dashboard)
│   └── $scheduleId.tsx         (refactor into 6-step flow)
│       Steps rendered as internal state machine:
│         setup → live (timer+geo) → attendance → summary
```

**Search-param state** on `departments.tsx` via `validateSearch`:
`{ q?: string, status?: 'ACTIVE'|'SUSPENDED', scroll?: number }` — restored on back-nav.

**Approvals refactor**:
- Top bar: Department `<Select>` (defaults to MA's last choice in localStorage).
- Body: Week tabs (`Week 1 … Week N` derived from semester).
- Per week: list with `[View] [Approve] [Send-back w/ comment]`.
- `[View]` opens `<Dialog>` with that week's full timetable (reuses existing schedule grid component).

---

## 3. Server Functions (new in `src/lib/`)

`approvals.functions.ts`
- `listDepartmentsWithPendingCounts()` → `{ id, name, pending_count }[]`
- `listApprovalWeeks({ department_id, semester_id })` → `{ week_num, count }[]`
- `listWeekSchedules({ department_id, week_num })` → full timetable rows
- `decideWeek({ department_id, week_num, decision, comment })` → bulk decide

`departments-detail.functions.ts`
- `getDepartmentOverview({ department_id })` →
  `{ levels[], sections_by_level{}, trainers[], modules: { completed, ongoing } }`

`imports.functions.ts`
- `validateImport({ kind, rows })` — FK checks (module codes exist, trainer IDs exist, dept/level/section resolve). Returns `{ valid, errors: [{row, field, msg}] }`.
- `applyImport({ job_id })` — only runs if `status='validated'`.

`mobile-session.functions.ts` (thin wrappers over existing `dh.functions.ts`)
- `getTodaySchedule()`, `checkInSession({schedule_id, lat, lng})`,
  `submitAttendance({schedule_id, entries})`, `getSessionSummary({schedule_id})`.

All protected with `requireSupabaseAuth`.

---

## 4. Mobile Trainer Flow (6 steps)

Single route `ground/$scheduleId.tsx` driven by `useState<Step>`:

1. **Auth** — handled by existing `_authenticated` guard.
2. **Dashboard** (`ground/index.tsx`) — today's list, tap a card → step 3.
3. **Setup** — show dept/level/module metadata; `[Start Session]` button.
4. **Live** — `<CountdownTimer minutes={50} />` + `useGeoGatekeeper(venue)` gate. `[Check in]` disabled until inside radius.
5. **Attendance** — student list with Present/Absent toggle, sticky `[Submit]`.
6. **Summary** — counts + % bar chart, `[Back to Dashboard]`.

Offline writes continue to flow through existing `offline/queue.ts`.

---

## 5. Theme

Update `src/styles.css` tokens to enterprise blue/white:
- `--primary: oklch(0.45 0.18 250)` (deep blue)
- `--background: oklch(1 0 0)`, `--card: oklch(0.99 0.003 250)`
- `--accent`/`--ring` derived blues.
No component-level color changes — tokens cascade.

---

## 6. Documentation Package (delivered as `/mnt/documents/` artifacts)

Generated via Python + openpyxl:

**Files:**
1. `tvet-omni-sync-docs.xlsx` — workbook with tabs:
   - **Data Dictionary** — all 22 tables × (column, type, nullable, default, business logic)
   - **User Training Manual** — Section / Step / Action / Visual Anchor / What-if
   - **Workflow Diagrams** — text representation of approval + mobile flows
   - **Changelog** — this update's items
2. `template-trainers.xlsx` — headers + 3 sample rows + Data-Validation rules (status dropdown, email regex via comment)
3. `template-students.xlsx` — headers + sample rows + dept/level/section dropdowns sourced from a hidden `Lookups` sheet
4. `template-modules.xlsx` — headers + dept lookup dropdown
5. `template-master-schedule.xlsx` — headers + dropdowns for Module Code, Trainer ID, Venue (populated from live DB at generation time)

Templates also linked from `strategic/imports.tsx` for in-app download.

QA: render each workbook page to PNG and visually inspect before delivering.

---

## 7. Build Order

1. Migration (`approval_queue.week_num`, `import_jobs`, indexes).
2. Theme tokens.
3. Server functions (approvals, dept-detail, imports, mobile-session).
4. Strategic routes: approvals refactor, departments list + detail.
5. Mobile trainer 6-step flow.
6. Imports page + template downloads.
7. Generate Excel documentation + templates → `/mnt/documents/`.

---

**Awaiting your approval to proceed.** If you'd like any scope trimmed (e.g., skip imports page and only ship Excel templates, or defer the theme swap), say so and I'll adjust before implementing.
