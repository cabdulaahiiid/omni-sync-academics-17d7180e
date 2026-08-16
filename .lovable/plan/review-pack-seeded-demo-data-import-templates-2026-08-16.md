# Review Pack: Seeded Demo Data + Import Templates

## Goal
Make every report in the system render with realistic TVET data, and hand you Excel templates that exactly match the current import logic.

## Part 1 — Seed realistic demo data (database)

One reversible seed migration that populates the existing empty tables so all 13 reports return real rows:

- Departments (use the 6 already present) + Levels I–IV and Sections A/B per level
- Modules: ~12 across departments (Theory / Practical / Both), with hours and session counts
- Trainers: ~10 in `trainer_registry` with qualifications, targets and completed sessions, mapped through `trainer_departments`
- Students: ~120 with registration numbers, gender, Ethiopian telephone numbers, parent/guardian name + phone + relationship
- Venues: labs, workshops, classrooms with coordinates and capacity
- Schedules: ~10 weeks of sessions across statuses (DRAFT, PENDING_MA, LIVE, COMPLETED, ENDED), published and unpublished
- Session logs + attendance logs so attendance percentages, compliance and velocity are non-trivial (mix of ~78–96% attendance)
- Approval queue entries (pending / approved / rejected) and feedback threads
- Audit log entries covering logins, imports, approvals and admin actions

All rows are tagged as demo so they can be cleared later with the existing reset function.

## Part 2 — Sample populated reports (for review)

After seeding, run each report in the catalogue and export a print-ready PDF pack using the existing enterprise report template (title, filters, period, totals, footer):

Academic: Student enrollment, Attendance summary, Trainer workload, Timetable utilization, Level progress
Department: Department performance, Trainer performance, Attendance compliance, Active sessions
Admin: Institution summary, User & audit activity, Compliance summary
Approvals: Approval report

Delivered as a single downloadable PDF pack plus one Excel workbook (one sheet per report) so you can review layout and totals side by side.

## Part 3 — Excel import templates (downloadable files, no app changes)

One `.xlsx` per import function currently in the system. Each file has a Data sheet (exact headers + 2–5 example rows using real seeded values) and an Instructions sheet marking required vs optional, type, allowed values and notes.

1. Students roster — `student_id_code`, `full_name`, `gender` (level and section come from the on-screen selectors, not the file)
2. Modules — `code`, `name`, `department_name`, `level_name`, `type` (Theory/Practical/Both), `qualifications`, `total_hours`, `total_sessions`
3. Other staff / contact book — `full_name`, `phone`, `role_title`, `department`
4. Semester timetable — `module_code`, `module_name`, `trainer_name`, `frequency`, `duration_min`, `section_name`, `level_name`, `venue_name`, `day`, `start_time`

Headers and allowed values are taken from the current validators, not invented. Example rows use department, level, section, trainer and module names that exist after seeding, so a template can be uploaded as-is.

## Technical notes
- Seeding is a single SQL migration using literal INSERTs (no app-side seeding).
- Reports are read through the existing `runReport` dispatcher; no report logic is changed.
- Templates are generated with the same column spec shape already used by `src/lib/xlsx-templates.ts`, so they stay consistent if in-app buttons are added later.
- No UI or business-logic files are modified.
