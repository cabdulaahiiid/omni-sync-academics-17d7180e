# Targeted fixes — Approvals, Feedback, Drafts conflicts, Upload templates

Scope is locked to what you confirmed. Nothing else is touched.

## 1. Approval Queue toolbar (additive; tabs + rows preserved)
File: `src/routes/_authenticated/strategic/approvals.tsx`

Add a toolbar above existing `Tabs`:
- Search input (matches module code, module name, semester name, trainer name)
- Status filter (pending / approved / rejected) — defaults to pending
- Conflict filter (any / trainer / venue / qualification / load)
- Sort: newest / oldest / module code
- Pagination: 10 / 25 / 50 per page

Implementation: client-side filter/sort over already-fetched arrays (`semData`, plus a new `sessionData` query reusing `listApprovalQueue({ type:'session' })` for a flat session list when the Sessions tab is active and no department is selected). Existing per-department weekly grid stays as-is. Realtime channel + decideSemMut/splitMut/rejectSem flows are untouched.

## 2. Approve / Send Back / Feedback wiring — verification + fixes
The MA RPCs (`decide_approval`, `ma_decide_week`, `ma_reject_semester_with_feedback`, `ma_split_semester_to_weeks`) are present and correct. The button handlers in `approvals.tsx` are wired. What's actually missing:

- **DH resubmit on FEEDBACK_ACTIVE semester**: `dh_resubmit_semester` requires `status='PENDING_MA'` already (it sets that). But `submit_for_approval` only flips `DRAFT→PENDING_MA` and skips when distribution_status='FEEDBACK_ACTIVE'. The DH drafts page calls `requestSemesterApproval` (which uses `submit_for_approval`) — after a rejection, the semester sits in `FEEDBACK_ACTIVE` and pressing "Request Semester Approval" silently no-ops. Fix in `src/lib/semester-drafts.functions.ts → requestSemesterApproval`: detect `distribution_status IN ('FEEDBACK_ACTIVE','DRAFT')` and route to `dh_resubmit_semester` RPC when state is FEEDBACK_ACTIVE; otherwise keep existing path.
- **Realtime for notifications bell**: ensure `notifications` table is in `supabase_realtime` publication (migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` — idempotent via DO block).
- **Audit logs** are already written by every RPC — no change.

## 3. DH conflict resolution in Schedule Builder (drafts)
File: `src/routes/_authenticated/operational/drafts.tsx` + `src/components/week-timetable-dialog.tsx`

Add to the existing `WeekTimetableDialog` (DH only — gate via `useMe().roles.includes('DH')`):
- Per-row conflict badges (trainer / venue / qualification / load) read from a new server fn `getWeekConflicts({ semester_id, week_num })` that reuses the same checks `approval_queue` runs. Read-only on non-DRAFT rows.
- Inline **Edit** (date/time/venue/trainer) — reuses existing `updateDraftSession`.
- Inline **Delete** — new server fn `dhDeleteDraftSession({ schedule_id })` that hard-deletes only when `status='DRAFT'` and `schedules.department_id = current_department_id()`; writes audit log.
- "Resolve" button on each conflicted row is a quick auto-fix: bumps start_time by 30 min OR clears the duplicate booking; if no auto-fix possible, focuses the Edit panel.

No new role enum. Permissions enforced by RPC + RLS on `schedules` (DH-of-department already exists).

## 4. Sample Excel templates on every upload screen
Files: `src/routes/_authenticated/operational/semester-upload.tsx`, `src/routes/_authenticated/operational/students.tsx`, `src/routes/_authenticated/strategic/modules.tsx`, `src/components/csv-dropzone.tsx`

Add a `<DownloadTemplateButton schema={...} />` next to each upload control. Generates the .xlsx client-side with `xlsx` (already viable; add via `bun add xlsx`):
- Sheet 1 "Data": real column headers + 2 example rows
- Sheet 2 "Instructions": one row per column with type, required/optional, allowed values, format example

Schemas:
- **Semester timetable** — date, start_time, end_time, module_code, trainer_email, venue_code, section_name, week_num
- **Students roster** — student_id, full_name, email, section_name
- **Modules** — module_code, module_name, level, credits, qualification_required
- (Trainers/Venues/Sections screens have no file upload today — skipped per current code.)

## 5. Out of scope (explicitly not changing)
- Trainer dashboard, check-in/end session, attendance — already work
- Existing RLS, auth, role model
- Existing realtime channels and notification triggers
- Visual restyle of Approvals beyond the new toolbar
- Dean / Academic Director / Master Admin roles (you said: only DH)

## Technical notes
- One migration: `notifications` realtime publication + `dh_delete_draft_session` RPC + `get_week_conflicts` SQL function.
- Three server fns added in `src/lib/approvals.functions.ts` and `src/lib/dh-ops.functions.ts`.
- One new client helper `src/lib/xlsx-templates.ts` + one new component `src/components/download-template-button.tsx`.
- `requestSemesterApproval` patched to branch on `distribution_status`.
- No edits to: routeTree.gen.ts (auto), Supabase client files, working trainer/attendance code.
