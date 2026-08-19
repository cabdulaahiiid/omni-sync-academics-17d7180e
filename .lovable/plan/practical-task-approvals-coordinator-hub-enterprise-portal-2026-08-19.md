# Practical Task Approvals, Coordinator Hub & Enterprise Portal

Four connected pieces: task-level approval states for practical sub-sessions, a gate that only shows trainers the Industrial Practical Training area when they actually have a placement, a dedicated enterprise-trainer portal, and a cross-department coordinator dashboard.

## 1. Sub-session task confirmations with approval states

New table `ct_practical_task_confirmations`, one row per (placement, practical task, date):

- Lifecycle: `DRAFT -> SUBMITTED -> ENTERPRISE_APPROVED / RETURNED -> LOCKED`.
- Enterprise attendance per task: status (Present / Late / Absent / Excused), hours, performance rating, safety flag, remarks.
- Conflict checks enforced in a database function, not only in the UI:
  - the same task cannot be confirmed twice for the same placement and date,
  - total confirmed hours for one trainee on one day cannot exceed the configured daily maximum,
  - a task cannot be confirmed outside the placement start/end window,
  - a locked or approved row cannot be silently overwritten; it must go through a correction.
- Optimistic concurrency: every decision passes the row's `version`; a stale version returns a clear "this record changed while you were reviewing it" message instead of overwriting.

**Audit-safe corrections.** Approved rows are never edited in place. A correction writes a new `ct_practical_task_corrections` row holding the previous values, the new values, the reason (required) and the actor, then updates the confirmation and bumps its version. Corrections and decisions are also written to the existing audit log, and the correction history is visible on the record.

## 2. Trainer access gate — `isTrainerAssignedToPracticalPlacement(trainerId)`

- Server helper + database function that returns true when the trainer is the visiting trainer on at least one placement in `CONFIRMED` or `ACTIVE` state (department-scoped).
- Exposed through the current-user query so the UI can read it once.
- The Industrial Practical Training tab is hidden for TVET trainers without an assignment, and direct URL access is blocked server-side: the training routes and their server functions reject unassigned trainers with an explanatory message rather than an empty page.
- Admins, department heads, coordinators and directors are unaffected.

## 3. `/enterprise-portal` — Enterprise Trainer workspace

New route space for `ENTERPRISE_TRAINER` only, built on the shared app shell:

- `/enterprise-portal` — today's roster: assigned trainees, their scheduled practical tasks for the day, and pending counts.
- `/enterprise-portal/logbooks` — review queue of submitted sub-session logbook entries: approve, return with a reason, or open the correction dialog on an already-approved entry.
- `/enterprise-portal/attendance` — record enterprise attendance per practical task for each trainee, with hours and remarks, using the conflict checks above.
- Mobile-first, offline-tolerant like the existing industry screen; the current `/industry` route keeps working and points at the new portal so no existing link breaks.

## 4. `/coordinator/dashboard` — cross-department request hub

For the Industrial Practitioners Supervisor / coordinator role (and admins):

- Aggregated view of Department Head industrial training requests across every department: counts by status, ageing (oldest pending), per-department breakdown, and a filterable request list.
- Drill-through into the existing supervisor queue actions.
- **Strict isolation:** aggregation only crosses departments for coordinator, director and admin roles. A department head opening the same dashboard sees only their own department. This is enforced in the database function that produces the aggregate, not by UI filtering, and covered by tests.

## Technical notes

- Migration: `ct_practical_task_confirmations`, `ct_practical_task_corrections`, plus grants, RLS (enterprise trainer scoped to their enterprise's placements; trainee read-own; staff scoped by `ct_can_access_department`), and security-definer functions `ct_confirm_practical_task`, `ct_decide_practical_task`, `ct_correct_practical_task`, `ct_is_trainer_on_active_placement`, `ct_coordinator_request_summary`.
- New server functions in `src/lib/ct/practical-tasks.functions.ts` and `src/lib/ct/coordinator.functions.ts`, all behind `requireSupabaseAuth` + `requireRole`.
- Role matrix (`src/lib/auth/role-matrix.ts`) gains `enterprisePortal`, `coordinatorDashboard` and a dynamic rule for the trainer practical tab.
- Unit tests for the state machine, conflict rules and department isolation.
- No changes to the schedule builder or module registry beyond reading the practical task tree already stored with each plan.
