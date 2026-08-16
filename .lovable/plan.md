# DH Scheduling Engine — Canonical Rebuild

Scoped to the Department Head scheduling workflow. Admin (MA) keeps today's behaviour on every shared path.

## Current state (verified)

- `planOccurrences` in `src/lib/semester-builder.functions.ts` generates a session on every selected teaching day from the start date until the **term's end date**. Session count is driven by the calendar window, not by the module's required hours.
- The builder UI has a "sessions per week" input that is never included in the payload sent to the server — frequency currently has no effect on generation.
- The end date in the validation summary is the last occurrence inside the term window, and week numbers are anchored to the term's Monday.
- Module hours are used only for a soft warning ("proposed contact hours exceed module total"), never to stop generation.
- Save inserts session rows in chunks of 200 with no transaction; a mid-way failure leaves a partial schedule behind. There is no parent record and no session number.
- On the DH drafts page the realtime channel invalidates `semester-drafts` and `week-feedback-threads` only — the Full Module query key `draft-modules` is never invalidated, so that view goes stale until a manual reload.

## 1. Canonical model

A new table `schedule_plans` holds the authoritative parameters for one DH schedule: term, department, level, module, trainer, section, venue, delivery mode, teaching days, sessions per week, session duration, start date — plus the derived results (total sessions, total minutes, week count, end date).

Session rows in `schedules` gain `plan_id` and `session_number`. One plan, N sessions; every view reads those rows.

```text
schedule_plans (1)
      |
      +-- sessions (N)  -> session_number, week_num
                |
                +-- Weekly View (grouped by week)
                +-- Full Module View (chronological)
```

Existing rows keep working: `plan_id` is nullable, and Admin-created rows simply have none.

## 2. One scheduling engine

A single pure module `src/lib/scheduling/engine.ts` owns all the math and is imported by both the validation and the save server functions. No calculation lives in the UI.

- **Required sessions** = module total hours ÷ session duration. A remainder becomes one explicit shorter final session (45h at 2h → 22 x 2h + 1 x 1h). Never rounded up into extra full sessions.
- **Frequency = sessions per week.** N sessions are placed each week across the selected teaching days in order, wrapping to the next week when the days run out.
- **Generation** walks forward from the start date emitting sessions in order with session number, date, day, start/end time, minutes and mode, stopping as soon as the required hours are met.
- **End date** = date of the last generated session. **Weeks** come from grouping the generated sessions, with W1 being the module's own first teaching week, numbered consecutively.
- If the term ends before the required hours fit, generation stops at the term end and the DH gets a clear "hours not fully scheduled" error before save.

The engine is covered by unit tests for the edge cases listed below.

## 3. Save to Draft is atomic

A security-definer database function `dh_save_schedule_plan` receives the plan plus the generated session list and, in one transaction:

1. re-validates department / level / module / section / trainer / venue relationships,
2. re-runs conflict detection against real session time ranges,
3. inserts the plan row,
4. inserts all session rows with plan id and session number,
5. writes the audit entry.

Any failure rolls everything back — never a plan without sessions or sessions without a plan. Regenerating after a parameter change deletes the old plan's draft sessions and re-inserts inside the same transaction, so stale sessions cannot survive a change to Level, Module, Trainer, Section, Venue, frequency, duration, days, start date or time.

## 4. Conflict detection

Overlap is evaluated per generated session on the same date for trainer, venue and section, using the standard half-open comparison (new start before existing end, and new end after existing start) — plus a self-check so one plan cannot generate two overlapping sessions for the same section. It runs in the client preview, in the server validate call, and again inside the save transaction.

## 5. Validation at four levels

1. UI: fields ordered and cleared in sequence (Year → Level → Module → Trainer → Section → Venue → frequency → duration → days → start date → time), with a field-specific missing list.
2. Client business rules: the engine runs locally for the live preview.
3. Server: validate and save re-derive everything from the database, rejecting mismatched Level/Module or out-of-department references for DH callers.
4. Database: the save function re-checks relationships and conflicts before committing.

Class Assignment keeps Section + Venue only; Level is inherited from the main schedule.

## 6. Live synchronization

- One shared hook drives DH realtime: a single channel per department covering schedules, schedule plans, term registry, approvals, feedback threads and messages, and notifications — subscribed once, cleaned up on unmount, with debounced invalidation.
- Invalidation covers every DH query root, including `draft-modules`, which is currently missed.
- Events invalidate canonical queries instead of appending payloads, so a duplicate event is a no-op and record identity is always the database id.
- On reconnect the hook refetches affected queries rather than assuming nothing was missed.
- Mutations invalidate rather than hand-patch the cache, keeping the database the single source of truth.

## 7. Weekly and Full Module views

Both read the same session rows for a plan. Weekly groups by week number, showing only weeks that actually contain sessions (no empty placeholders); Full Module lists every session chronologically with its session number. Neither recalculates anything.

## 8. Admin unchanged

The new engine, plan table and DH validation apply only when the caller's role is DH. Admin calls keep the existing generation path, draft behaviour and UI, and never pick up the DH-specific weekly/full-module changes.

## 9. Acceptance matrix

Verified after implementation: exact and inexact hour division, 1h and 2h modules, one session per week, multiple per week, month and year crossings, weekend boundaries, each parameter change regenerating dependent data, repeated saves, browser refresh, two concurrent DH viewers, duplicate and disconnected realtime events, failed-transaction rollback, conflict rejection, invalid Level/Module through a crafted request, and empty required fields.

## Technical notes

- Migration: `schedule_plans` table with grants and DH/MA policies, `plan_id` + `session_number` columns on `schedules`, the `dh_save_schedule_plan` and `dh_regenerate_schedule_plan` functions, and realtime publication for the new table.
- New files: `src/lib/scheduling/engine.ts` (pure, tested), `src/lib/scheduling/engine.test.ts`, `src/hooks/use-dh-schedule-live.ts`.
- Edited: `src/lib/semester-builder.functions.ts` (DH path delegates to the engine and the transactional save), `src/routes/_authenticated/operational/semester-upload.tsx` (sends frequency, shows engine-derived preview), `src/lib/semester-drafts.functions.ts` and `src/routes/_authenticated/operational/drafts.tsx` (plan-based weekly/full-module views, corrected invalidation).