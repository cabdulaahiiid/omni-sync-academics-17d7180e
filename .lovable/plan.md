# TVET Omni-Sync ERP — Reconstruction Plan

## Scope

The spec describes a fully built ERP. The current project already contains a large portion of this (schedules, sessions via `submit_session_batch`, attendance, departments, modules, students, semesters, approvals, audit, RLS for MA/DH/Trainer, three role shells under `_authenticated/strategic|operational|ground`). However, the spec's schema and naming differ from what's deployed, and several spec features are missing (collaborative reject-chat, 150 m geofence constant, 10/20-minute timers, CSV bulk import for modules/students, percentage-split sliders, profile `bypass_geofence`, exact spec table names).

Rather than rebuild from zero (which would destroy working data and code), this plan **maps the spec onto the existing system** and fills the gaps. I'll flag where the spec and current DB diverge so you can confirm direction before I touch anything.

## Key divergences (need your decision)

The current DB uses richer, production-grade names; the spec uses simpler ones. Examples:

| Spec table/field | Current equivalent |
|---|---|
| `semester_timetables` | `semester_registry` (+ `schedules` rows) |
| `sessions` | `schedules` + `session_logs` + `attendance_logs` |
| `schedule_feedback_threads/messages` | not present |
| `profiles.bypass_geofence` | not present (global `venues.geo_radius`) |
| `sessions.status` enum (Scheduled/In_Progress/Missed/Completed) | `schedules.status` (DRAFT/PENDING_MA/LIVE/ACTIVE/ENDED/CANCELLED) |
| Roles Admin / DH / Trainer | MA / DH / T |
| 150 m fixed geofence | per-venue `geo_radius` (default 50) |

**Question for you:** keep the current schema (recommended — preserves data, RLS, server fns) and add only the missing pieces, OR rename everything to match the spec literally (destructive)?

This plan assumes **keep current schema + add missing pieces**. If you want literal renames, say so and I'll rewrite.

## Phase 1 — Schema additions (migration)

Add only what's missing:

1. `profiles.bypass_geofence boolean default false`
2. `schedule_feedback_threads(id, semester_id, admin_id, dh_id, created_at)` — one per rejected semester
3. `schedule_feedback_messages(id, thread_id, sender_id, message, created_at)` — RLS: MA full, DH only own department's thread
4. Enable realtime on `schedule_feedback_messages`, `schedules`, `semester_registry`, `notifications`
5. Add `global_config.campus_lat`, `campus_lng`, `campus_radius_m` (default 150) so the geofence is institution-wide (spec calls for 150 m campus-wide, not per-venue)
6. RPC `submit_feedback(_semester_id, _message)` (MA) → creates thread+message, sets `semester_registry.status='DRAFT'`, unlocks DH edits, emits notification
7. RPC `dh_reply_feedback(_thread_id, _message)` (DH) → appends message
8. RPC `dh_resubmit_semester(_semester_id)` (DH) → sets status back to `PENDING_MA`

## Phase 2 — Admin (MA / "Strategic") gaps

Existing strategic routes cover departments, levels, sections, modules, semesters, trainers, venues, users, approvals, audit, reports, settings, insights. Add/finish:

- **Modules tab**: percentage split sliders (theory/practical, must total 100), Total Hours field, CSV bulk import (`code,name,level,total_curriculum_hours,theoretical_percent,practical_percent`)
- **Users tab**: ensure full create-user flow (name/email/password/role/department) wires to auth + profile + role; add `bypass_geofence` toggle per user
- **Schedule Approvals**: add **Reject with feedback** modal → calls `submit_feedback` RPC; show conversation thread inline beside the rejected semester
- **Settings**: add campus lat/lng/radius inputs writing to `global_config`

## Phase 3 — DH ("Operational") gaps

Existing operational routes cover attendance, live-monitor, matrix, reports, semester-upload. Add/finish:

- **Students Hub** tab: single-entry form + CSV dropzone (`student_id_code,full_name,level,section`) → bulk insert
- **Schedule Builder**: when a semester is `DRAFT` after rejection, render embedded chat panel beside the matrix (realtime subscription on `schedule_feedback_messages`); "Resubmit to Admin" calls `dh_resubmit_semester`
- **Department Modules**: CSV importer (same parser as MA modules)
- **Live Operations Monitor**: countdown bars per active session (reuse `CountdownTimer`)

## Phase 4 — Trainer ("Ground") gaps

Existing ground routes cover today's list + per-schedule check-in/out. Add/finish:

- **Start Session** button enables only within `start_time − 10min` → `start_time + 20min`; after that, client marks session disabled (DB-side enforcement stays as-is)
- **Geofence**: switch from per-venue check to global `campus_lat/lng/150 m` unless `profiles.bypass_geofence = true`
- **Check-out window**: enable roll-call 10 min before `end_time`, vibrate device (`navigator.vibrate`)
- **Roster default**: pre-fill all students as present (already done — verify)
- **My Weekly Calendar** tab: read-only week grid
- **Student Progress** tab: per-student attendance% in trainer's sections
- **Performance Logs** tab: punctuality delta, hours delivered, session history

## Phase 5 — Real-time wiring

- `useDhLiveChannel` already subscribes to schedule changes; extend to subscribe to `schedule_feedback_messages` per thread for both MA and DH chat panels
- Notifications bell already exists; emit notifications on reject, resubmit, approve

## Phase 6 — Integration & QA

- Seed/verify one full happy-path: department → users → modules (CSV) → students (CSV) → semester upload → DH submits → MA rejects with comment → DH chats + edits + resubmits → MA approves → trainer checks in (geofenced) → checks out → reports export
- Build clean; smoke-test each of the three role shells

## Files I'll touch (high level)

- `supabase/migrations/<new>.sql` — phase 1
- `src/lib/dh.functions.ts`, `src/lib/ma.functions.ts`, `src/lib/modules.functions.ts` — new server fns for feedback, CSV import, bypass toggle
- New: `src/lib/feedback.functions.ts`, `src/components/feedback-chat.tsx`, `src/components/csv-dropzone.tsx`, `src/components/percent-split.tsx`
- `src/routes/_authenticated/strategic/approvals.tsx` — reject modal + chat
- `src/routes/_authenticated/strategic/modules.tsx` — sliders + CSV
- `src/routes/_authenticated/strategic/users.tsx` — bypass toggle
- `src/routes/_authenticated/strategic/settings.tsx` — campus geo
- `src/routes/_authenticated/operational/semester-upload.tsx` — chat panel on reject
- New: `src/routes/_authenticated/operational/students.tsx`
- `src/routes/_authenticated/operational/matrix.tsx` — CSV module import section (or new modules.tsx)
- `src/routes/_authenticated/ground/$scheduleId.tsx` — global geofence, 10/20min gating, vibrate
- New: `src/routes/_authenticated/ground/week.tsx`, `ground/progress.tsx`, `ground/performance.tsx`
- `src/hooks/use-geo-gatekeeper.ts` — switch to global campus center
- `src/hooks/use-dh-live-channel.ts` — extend to feedback messages

## Estimated size

~25–30 files, 1 migration, ~6 new RPCs. Will land in 3–4 implementation passes so each phase compiles and is verifiable before the next.

---

**Please confirm:**
1. Keep current schema + augment (recommended), OR rename to spec literal names (destructive)?
2. Global 150 m campus geofence (spec), OR keep per-venue radius (current)?
3. Anything to drop from scope to land faster?
