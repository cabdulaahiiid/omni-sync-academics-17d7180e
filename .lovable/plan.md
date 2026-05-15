
# TVET SaaS ERP — Full Production Build Plan

This plan implements every step in the spec: MA 1–10, DH 1–12, Trainer 1–11, and the Realtime DH monitoring matrix. No stubs, no TODOs.

## 1. Database — State Machine & Schema Hardening

Single migration extending the existing schema (does not break current data).

**Status enums (canonical state machine):**
- `schedule_status`: `draft → pending_ma → live → active → ended → cancelled`
- `semester_status`: `draft → pending_ma → live → active → ended`
- `approval_queue.type` enum: `semester | session`
- `approval_queue.decision` enum: `pending | approved | rejected`

**New / altered columns:**
- `schedules`: add `mode` (Theory|Practical|Both, nullable until trainer sets), `checkin_at`, `attendance_locked_at`, `ended_at`
- `semester_registry`: add `status` transitions + `approved_by`, `approved_at`, `source_file_url`
- `approval_queue`: add `type`, `target_id` (uuid), `submitted_by`, `decision`, `decided_by`, `decided_at`, `comment`
- `attendance_overrides`: already exists — wire trigger to enforce `now() < attendance_locked_at + 24h`
- `audit_logs`: ensure DH overrides write `audit_comment` (NOT NULL guard at app + DB)

**Triggers / functions:**
- `enforce_schedule_transition()` — BEFORE UPDATE on `schedules.status`, only allow legal transitions per state machine.
- `enforce_attendance_lock()` — BEFORE UPDATE/INSERT on `attendance_overrides`: reject if `now() > attendance_locked_at + 24h` OR if actor is trainer (DH/MA only).
- `lock_attendance_on_submit()` — set `attendance_locked_at = now()` when session_logs row finalized.
- `bump_progress_on_end()` — increment trainer `sessions_completed` counter when status flips to `ended`.

**Realtime publication:** add `schedules`, `attendance_logs`, `session_logs`, `approval_queue`, `notifications` to `supabase_realtime`.

## 2. Backend — Server Functions (createServerFn)

All under `src/lib/*.functions.ts`, protected by `requireSupabaseAuth` and a thin `requireRole('MA'|'DH'|'T')` gate.

**MA functions** (`ma.functions.ts`):
- `createDepartment`, `bulkImportModules` (xlsx parser), `uploadSemester`,
- `listApprovalQueue({type})`, `decideApproval({id, decision, comment})`,
- `toggleSessionStatus`, `dashboardInsights` (live count, workload, growth).

**DH functions** (`dh.functions.ts` — extend existing):
- `toggleLevel`, `upsertSection`, `registerTrainer` (deterministic hidden_staff_id via `gen_random_uuid()` derived from `digest(full_name||dept||created_at,'sha256')`),
- `bulkUploadStudents` (xlsx, columns: Name, Level, Section),
- `uploadSemesterExcel` → calls **Temporal Slicing Engine** (see §3),
- `getWeeklyMatrix({week_start})` returning `trainers × dates` grid with conflict flags (overlapping trainer/venue),
- `swapTrainer({schedule_id, new_trainer_id})` (no MA approval, audit logged),
- `submitForApproval({schedule_ids|semester_id, type})` → inserts `approval_queue` rows,
- `overrideAttendance({log_id, present, audit_comment})` (24h window enforced).

**Trainer functions** (`trainer.functions.ts` — extend):
- `getTodaySchedule`,
- `setSessionMode({schedule_id, mode})`,
- `checkIn({schedule_id, lat, lng})` — **30-Minute Gatekeeper** server-side: time window AND haversine ≤ 200m. Returns `{checkin_at, roster_unlock_until}`.
- `submitAttendanceBatch` (already exists; extend to enforce 50-minute window from `checkin_at`),
- `endSession({schedule_id, learning_outcome, lesson_plan})` — both required, sets `status='ended'`, `ended_at=now()`, locks attendance.
- `myProgressCounter()` → `{completed, target:15}`.

## 3. Temporal Slicing Engine

`src/lib/slicing.server.ts` invoked by `uploadSemesterExcel`.

Input row shape: `Module Code | Module Name | Trainer Name | Frequency (per week) | Duration (min) | Section | Level | Venue (optional) | Day | Start Time`.

Pipeline:
1. Parse xlsx (`xlsx` lib — already in deps).
2. Resolve `Trainer Name → trainer_registry_id + hidden_staff_id` (case-insensitive, dept-scoped, fuzzy fallback raises row error).
3. Resolve module by code, venue by name (auto-create classroom venue if missing with geo=dept default).
4. For each row × 16 weeks × frequency: emit a `schedules` row with computed `date = semester.start_date + ((week-1)*7) + dayOffset(Day)`, `start_time`, `end_time = start_time + duration`, `status='draft'`, `week_num=1..16`.
5. Detect conflicts in-memory (same trainer overlap, same venue overlap) → mark in result report, persist as-is so DH can fix on the matrix.
6. Return `{created, conflicts, errors}` summary.

## 4. Frontend — Three Role Surfaces

### MA Console (`/_authenticated/strategic`)
- Existing dashboard + new pages: **Approval Queue** (tabs: Semester | Session, approve/reject with comment), **Insights** (live sessions, workload heatmap, pending growth), **Modules bulk import** modal, **Semester upload** modal.

### DH Console (`/_authenticated/operational`)
- Sub-routes: `levels`, `trainers`, `students` (bulk upload), `semester-upload`, `matrix` (weekly grid, conflict highlight, swap-trainer drawer), `approvals` (already), `live-monitor`, `attendance` (with 24h override).
- **Live Monitor Matrix**: subscribes to `postgres_changes` on `schedules`, `attendance_logs`, `session_logs` filtered by `department_id`. Indicator chips: `live | checked-in | attendance-submitted | ended`. Uses existing supabase realtime channel.

### Trainer Mobile (`/_authenticated/ground`)
- Today's schedule list → session detail → mode selector → **Check-In button** (client mirrors server gatekeeper: enabled iff time window + GPS ≤ 200m, geolocation polled every 10s) → 50-min countdown → roster (offline-queued via existing Dexie outbox) → LO + Lesson Plan form (both required) → End Session → progress counter `X / 15`.
- All writes go through existing offline queue; `checkIn` and `endSession` enqueued the same way with idempotency keys.

## 5. Realtime Broadcast Matrix

Single `useDhLiveChannel(departmentId)` hook subscribes to:
- `schedules:status=eq.live`
- `session_logs` inserts (check-in)
- `attendance_logs` inserts (attendance submit batch)
- `schedules:status=eq.ended` (end)
- `attendance_overrides` inserts (DH override → audit log)

Each event mutates a Zustand store keyed by `schedule_id`; DH grid re-renders without polling.

## 6. Reports & Exports

Extend `exports.functions.ts` with: per-semester attendance %, LO/lesson-plan dump, trainer velocity (sessions completed vs assigned), conflict log. CSV today; XLSX behind same fn using `xlsx`.

## 7. Seeding

Extend existing `seedDemoData`: ensure 16-week semester + matching schedules so the entire MA→DH→Trainer loop is testable from `DH1@tvet.com / Head@123` and `trainer1@tvet.com / Trainer@123`.

## 8. File List

```text
supabase/migrations/<ts>_state_machine_and_engine.sql   (new)
src/lib/ma.functions.ts                                 (new)
src/lib/slicing.server.ts                               (new)
src/lib/dh.functions.ts                                 (extend)
src/lib/trainer.functions.ts                            (extend: checkIn, endSession, setMode, progress)
src/lib/exports.functions.ts                            (extend)
src/lib/seed.functions.ts                               (extend: 16-week schedules)
src/hooks/use-dh-live-channel.ts                        (new)
src/hooks/use-geo-gatekeeper.ts                         (new — client mirror of 30-min/200m rule)
src/routes/_authenticated/strategic/approvals.tsx       (new)
src/routes/_authenticated/strategic/insights.tsx        (new)
src/routes/_authenticated/operational/matrix.tsx        (new)
src/routes/_authenticated/operational/live-monitor.tsx  (new)
src/routes/_authenticated/operational/semester-upload.tsx (new)
src/routes/_authenticated/ground/$scheduleId.tsx        (new — full session detail flow)
src/components/approval-queue-table.tsx                 (new)
src/components/weekly-matrix.tsx                        (new)
src/components/swap-trainer-drawer.tsx                  (new)
src/components/countdown-timer.tsx                      (new)
```

## 9. Execution Order (single approval, then I ship)

1. Migration (state machine + triggers + realtime publication).
2. Server fns (MA, DH, Trainer, slicing engine).
3. Trainer mobile session detail (gatekeeper + 50-min + LO/plan + end).
4. DH matrix + live monitor + swap + override.
5. MA approval queue + insights + bulk imports.
6. Reports + extended seed.
7. Smoke check: log in as DH1, upload sample 16-week semester, approve as MA, log in as trainer1, run a session end-to-end.

## Open Questions (only blockers — everything else I will decide and build)

1. Geo-fence radius: spec says 200m for the gatekeeper but `venues.geo_radius` defaults to 50m. Should the gatekeeper override venue value with a fixed 200m, or use `max(venue.geo_radius, 200)`?
2. The 50-minute roster timer — does it auto-submit on expiry, or just close the input and require manual Submit?
3. Trainer target counter: hardcoded `/ 15`, or pull from a per-semester target column (would add `trainer_registry.session_target`)?

If you don't answer, I'll default to: (1) fixed 200m for gatekeeper, (2) manual submit required (no auto-submit), (3) hardcoded 15.

Reply **approve** (optionally with answers) and I execute end-to-end.
