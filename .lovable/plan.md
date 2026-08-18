# Cooperative & Industrial Practical Training Module

A new ERP domain at `/cooperative-training`, built on the existing backend (roles, students, departments, levels, modules, notifications, SMS, storage, offline queue, audit logs). Nothing existing is rewritten.

## What exists today and gets reused
- Roles: `app_role` = MA, DH, T with `has_role()` + `user_roles`. Server functions guard with `requireRole`.
- Master data: `departments`, `levels`, `sections`, `students` (with parent/guardian phone), `modules`, `trainer_registry`, `venues`.
- Notifications: `notifications` table + bell UI.
- SMS: `sms_campaigns` / `sms_recipients` / `sms_settings` + `src/lib/sms/provider.server.ts` (real smsethiopia gateway, dev-safe when unconfigured).
- Storage: private `avatars` bucket + signed-URL pattern.
- Offline: Dexie outbox in `src/lib/offline/*` (single queue — will be extended, not duplicated).
- Audit: append-only `audit_logs` with immutability trigger.
- Geofence math: `useGeoGatekeeper` + `global_config` (radius, geofence on/off).

## New roles
`app_role` gains `PD` (Program Director), `CO` (Coordinator), `VT` (Visiting Trainer), `EM` (Enterprise Mentor), `TR` (Trainee). Trainee and mentor logins are optional: `profiles` gains `student_id` (links a login to a student) and `ct_enterprise_contacts.user_id` links a mentor login. Parents get SMS only, no login.

## Phases

### Phase 1 — Database foundation (migration 1)
Curriculum + enterprise master data with UUID keys, timestamps, created_by, FKs, indexes, GRANTs, RLS:
`ct_occupations`, `ct_curriculum_versions`, `ct_training_modules`, `ct_units_of_competence`, `ct_training_tasks`, `ct_enterprises` (capacity, lat/lng, allowed_radius_meters, active), `ct_enterprise_contacts`, `ct_enterprise_training_sites`.
Occupations link to existing `departments`/`levels`; `ct_training_modules` may reference an existing `modules` row.
Seed data from the supplied logbook (BEI Units I–IV, SIW, FCW, Aluminum Works) inserted as literal rows in the migration — data, never hardcoded in React.

### Phase 2 — Workflow tables (migration 2)
`ct_training_requests`, `ct_training_request_students`, `ct_request_delegations`, `ct_training_schedules`, `ct_student_placements`, `ct_day1_checkins`, `ct_daily_logbook_entries`, `ct_logbook_approvals`, `ct_supervision_visits`, `ct_supervision_evidence`, `ct_absence_events`, `ct_final_evaluations`, `ct_uc_evaluations`, `ct_basic_competency_evaluations`, `ct_skill_gaps`, `ct_remedial_actions`, `ct_sms_queue`, `ct_sms_delivery_logs`, `ct_workflow_events`, `ct_assessment_queue`.
Integrity enforced in SQL: partial unique index for one active placement per student, unique day-1 check-in per placement, unique (placement, date, task) logbook row, unique assessment-queue entry per evaluation, capacity check trigger, status-transition trigger mirroring `enforce_schedule_transition`, lock trigger rejecting edits to APPROVED/LOCKED/FINALIZED rows, workflow-event + audit-log writes.
`ct_workflow_events` is append-only (same immutability trigger pattern as `audit_logs`).

### Phase 3 — RLS + privileged RPCs (migration 3)
- Security-definer helpers: `ct_is_staff()`, `ct_my_placements()`, `ct_mentor_enterprises()`, `ct_trainer_placements()`.
- Per-table policies: trainee → own placement rows; mentor → assigned enterprise rows; VT → assigned placements; DH → own department; PD/CO → delegated scope; MA → all. No `USING (true)` on any table.
- Atomic RPCs (all validate role + state server-side, write workflow + audit events, raise friendly errors):
  `ct_create_request`, `ct_submit_request`, `ct_delegate_request`, `ct_allocate_roster` (capacity-checked, transactional), `ct_finalize_roster` (locks placements + schedule), `ct_checkin_day1` (haversine geofence, accuracy, duplicate guard), `ct_submit_logbook_day`, `ct_mentor_decide_logbook`, `ct_record_supervision`, `ct_detect_absences` (configurable consecutive-day rule → absence event + parent SMS queue), `ct_submit_evaluation`, `ct_finalize_evaluation` (computes failed_uc_count, red_competency_count, remedial hours, recommendation, calculation_version), `ct_push_to_assessment`.
- Settings: theory threshold, max daily logbook hours, remedial hours per failed UC / red competency, absence-day threshold stored in a `ct_settings` row (admin-editable), not constants.
- New private storage bucket `ct-evidence` with owner/role-scoped policies; photos accessed via signed URLs.

### Phase 4 — Server functions
`src/lib/ct/*.functions.ts` (thin `createServerFn` wrappers with `requireSupabaseAuth` + `requireRole`), split by area: curriculum, enterprises, requests, allocation, checkin, logbook, supervision, evaluation, reports. All list endpoints are server-side filtered + paginated with explicit column selection. Zod validation on every input; typed error codes (VALIDATION / AUTHORIZATION / NOT_FOUND / CONFLICT / DATABASE) surfaced through the existing `explainError` layer.
Eligibility (theory %) is recomputed server-side from attendance/session data before a request can be created.

### Phase 5 — Routes & UI
`/cooperative-training` shell reusing the existing ERP design system (sidebar/topbar, `kpi-tile`, `status-badge`, `empty-state`, form layout, `use-form-submit`), role-aware sections:
Overview · Theory Completion Queue · Practical Requests · Delegation · Enterprise Allocation · Schedule & Roster Approval · Notifications · Day-1 Check-In · Digital Logbook · Supervision · Final Evaluation · Gap Analysis · Assessment Queue · Reports · Audit History.
Trainee and mentor screens (check-in, logbook, mentor approval) are mobile-first cards with large touch targets; DH/Admin screens are dense desktop tables. Curriculum pickers cascade Occupation → Module → UC → Task, enforced again server-side.

### Phase 6 — Logbook offline, realtime, SMS, reports
- Offline: extend the existing Dexie outbox with a `ct_logbook` entry kind and idempotent `client_uuid` replay — one queue, one sync loop, status chips Saved / Pending / Synced / Failed / Conflict.
- Realtime: extend the existing debounced invalidation hook pattern to the `ct_*` tables driving queues and statuses.
- SMS: `ct_sms_queue` dispatched through the existing provider; status only advances to SENT on provider acceptance, DELIVERED on callback, with retry counts and `ct_sms_delivery_logs`.
- Reports: real CSV from query results and a real PDF via the existing `report-export` enterprise template (institution, department, occupation, level, trainee, enterprise, period, UC P/NP, seven competencies, gaps, remedial hours, recommendation, evaluator).

### Phase 7 — Tests & end-to-end verification
Unit tests for the evaluation/remedial/recommendation engine, geofence distance, and state-machine transitions. A scripted end-to-end run through a test trainee: eligibility → request → delegation → allocation (including a capacity-overflow rejection) → roster lock → notifications → day-1 check-in → logbook → mentor approval → supervision → absence detection → dual evaluation → gap calculation → recommendation → assessment queue, with refresh persistence and a negative RLS check from an unauthorized role.

## Technical notes
- Every `ct_*` table: UUID PK, `created_at`/`updated_at` with trigger, `created_by`/`updated_by`, FKs, indexes on trainee/placement/enterprise/department/level/module/uc/task/date/status/created_at, explicit GRANTs, RLS enabled.
- All critical rules (capacity, locks, transitions, eligibility, duplicates, evaluation math) live in SQL functions/triggers; React validation is supplementary.
- No Supabase edge functions; app logic uses `createServerFn`, SMS callbacks use `/api/public/*`.
