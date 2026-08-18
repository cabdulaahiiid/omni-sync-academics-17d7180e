# Per-Department Industrial Practical Training — Isolation, Roles, Evaluation Engine

Today the practical training module is hard-wired to a single Industrial department (`ct_is_industrial_dh()`, IPS/PD workflow), placements carry `department_id` but evaluation rules live in one global `ct_settings` row and there is no daily-score/attendance model. This plan opens the module to every department, isolates data per department, and adds the scoring engine and the Industry Trainer app.

## 1. Every department gets its own module

- Drop the Industrial-only gate: any Department Head sees the practical training workspace for their own department only. Data isolation is enforced in the database, not in the screens — a DH, trainer, mentor, or trainee can only read and write rows whose department matches theirs.
- Existing requests, placements, logbooks, supervision visits and evaluations are kept as-is and simply become "the Industrial department's data".
- Admin keeps the cross-department view; the Supervisor (IPS) works across departments/enterprise zones as today.

## 2. Per-department competency lists and evaluation formula

- New DH settings screen inside the module:
  - **Practical checklist** — the department's own competency items (name, description, critical/safety flag, order), replacing the shared hard-coded seven competencies for that department.
  - **Evaluation configuration** — daily-log weight, industry evaluation weight, TVET trainer weight (must total 100), passing threshold, attendance threshold, and how many skill gaps are tolerated.
- Departments without a configuration fall back to the current global defaults so nothing breaks on day one.

## 3. Roles and supervisor actions

Six roles, all enforced server-side:

| Role | Scope |
| --- | --- |
| Administrator | everything, enterprise onboarding, roles, audit |
| Department Head | own department: checklist, config, requests, gap reports, final closure |
| Industrial Practical Supervisor | requests across departments/zones: Approve, Hold, Modify, Delegate |
| TVET Trainer | assigned trainees: curriculum alignment, mid-term checkpoint, log review |
| Industry Trainer (enterprise) | assigned trainees only: daily logs + final evaluation |
| Trainee | read-only view of own logs, attendance, feedback, colour status |

Supervisor actions gain the missing two: **Hold** (mandatory reason, notifies the DH, placement pauses) and **Modify** (edit dates, capacity, modules, notifies the DH). Approve and Delegate keep the existing version-checked concurrency guard; Hold and Modify get the same guard so two supervisors can't both act.

## 4. Scoring engine and 3-colour status

On final evaluation submission the database computes, per placement:

- Daily average score: mean of the 1–5 daily ratings scaled to 0–100.
- Attendance rate: (present + 0.5 x late) / scheduled days x 100.
- Composite: department weights applied to daily, industry evaluation and TVET trainer scores.
- Colour: GREEN when composite and attendance both pass and there are no gaps; YELLOW when both pass but gaps exist (a targeted remediation plan is generated and assigned to the TVET trainer); RED when either threshold fails or a critical safety breach was flagged.

All inputs, weights used and the resulting figures are stored on the evaluation row so a report can always be re-explained.

## 5. Industry Trainer app (mobile-first, works offline)

A stripped standalone workspace with only: trainee quick-selector, daily log form (attendance status, shift hours, 1–5 score, safety/task notes, multi-select skill-gap tags), and the final evaluation + checklist form. Daily logs are written to the existing offline queue and replay automatically when the connection returns, with Saved / Pending / Synced / Failed chips.

## 6. Skill gap analytics

Per-department view aggregating recurring gap tags across placements (count, severity, trend, affected trainees), exportable through the existing report template, to feed curriculum adjustment.

## Technical notes

- Migration: new enums `attendance_status`, `status_color`, `gap_severity`, and `ON_HOLD` / `MODIFIED` added to the placement/request flow. New tables `ct_department_competencies`, `ct_department_eval_configs`, `ct_daily_practical_logs` (attendance, hours, 1–5 score, safety flag, notes, client_uuid for offline replay), `ct_gap_tags` + tag link on `ct_skill_gaps`, `ct_remediation_plans`; `ct_final_evaluations` gains daily/eval/tvet scores, attendance rate, composite, colour and the weight snapshot. Every new public table gets GRANTs, RLS and department-scoped policies.
- New security-definer helpers `ct_user_department_ids()`, `ct_can_access_department(uuid)`, `ct_is_industry_trainer(placement)`; existing `ct_is_industrial_dh()` policies are widened to department matching rather than one fixed department. `ct_finalize_evaluation` is rewritten to use the department config and write the colour result.
- New RPCs `ct_ips_hold_request`, `ct_ips_modify_request` (both `_expected_version` guarded), `ct_upsert_department_config`, `ct_submit_daily_log`, `ct_generate_remediation_plan`.
- New server functions under `src/lib/ct/`: `department-config.functions.ts`, `daily-logs.functions.ts`, `industry-trainer.functions.ts`, `gap-analytics.functions.ts`; `evaluation-engine.ts` is extended to mirror the new maths and unit-tested.
- New routes: `cooperative-training/settings.tsx` (DH config + checklist), `cooperative-training/gaps.tsx`, and `src/routes/_authenticated/industry/*` for the enterprise trainer app; tab visibility driven by role.
- Offline: the existing Dexie outbox gains a `ct_daily_log` entry kind — one queue, one sync loop, idempotent by `client_uuid`.
- Tests: engine maths (composite, attendance, colour boundaries), cross-department isolation checks per role, and hold/modify/delegate concurrency.
