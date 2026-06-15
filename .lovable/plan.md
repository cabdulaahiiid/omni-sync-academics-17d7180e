# TVET ERP Enhancement Plan

Six features, one deployment. Preserves auth, RLS, existing approval RPCs (`decide_approval`, `ma_decide_week`, `ma_reject_semester_with_feedback`, `dh_resubmit_*`) and the new Weekly Approvals UI. Existing sidebar untouched — Feature 1 adds one new entry under Strategic.

---

## Feature 1 — System Data Management (MA only)

**New route:** `src/routes/_authenticated/strategic/system-data.tsx` (sidebar entry added to existing Strategic group only).

**Two destructive operations**, each via a confirm dialog requiring an exact-match phrase + the MA's current password (re-verified via `supabase.auth.signInWithPassword` against `me.email`) before the server fn runs.

**New SQL (migration):** two `SECURITY DEFINER` functions guarded by `has_role(auth.uid(),'MA')`:

- `public.wipe_entire_system()` — truncates every domain table in FK-safe order, then deletes every `auth.users` row except the calling MA, then writes a single final `audit_logs` row (created before truncation completes, persisted after via a temp table → re-insert pattern).
- `public.reset_academic_data()` — truncates only academic tables: `attendance_overrides, attendance_logs, session_logs, pending_sync, approval_queue, schedule_feedback_messages, schedule_feedback_threads, schedules, semester_registry, students, modules, trainer_skills, trainer_registry, leave_requests, notifications`. Keeps `profiles, user_roles, departments, levels, sections, venues, department_heads, global_config, audit_logs`.

**Server fns** (`src/lib/system-admin.functions.ts`, `requireSupabaseAuth` + MA check + `supabaseAdmin` loaded inside handler):
- `getWipePreview()` → row counts per affected table for both modes.
- `wipeEntireSystem({ confirm_phrase, password_ok })` — validates phrase `WIPE ENTIRE SYSTEM`, calls RPC, then `supabaseAdmin.auth.admin.deleteUser` for every non-MA auth user. Writes pre-action audit row.
- `resetAcademicData({ confirm_phrase })` — validates `RESET ACADEMIC DATA`, calls RPC. Writes audit row.

**UI:** two large cards, live record-count table, phrase input, password input, progress indicator during mutation, success toast + auto-refresh. Sidebar: append one item to existing Strategic group (no module added/removed elsewhere).

---

## Feature 2 — DH Conflict Resolution Panel

**File:** rebuild the swap sheet in `src/routes/_authenticated/operational/matrix.tsx` into a **Conflict Resolution Panel** (Sheet, wider).

**Panel contents** (read from existing `getWeeklyMatrix` conflict fields + a new `getConflictDetail` server fn that returns the conflicting schedule row(s), trainer/venue/section/module options for the dept):
- Conflict type chips (trainer / venue / qualification / load).
- Original vs Proposed columns.
- Editable fields: trainer, venue, date, start/end time, section, module.
- **Validate Conflict Resolution** button → calls `validateScheduleEdit({schedule_id, patch})` which re-runs the same conflict checks the matrix uses and returns `{conflicts: [...]}`.
- If empty → enable **Resubmit Schedule** (calls existing `dh_resubmit_week` / `dh_resubmit_semester` after applying patch via `updateDraftSession`).
- If not empty → list remaining issues inline; resubmit stays disabled.

**New server fns** in `src/lib/dh-extras.functions.ts`: `getConflictDetail`, `validateScheduleEdit`, `applyScheduleEdit` (wraps existing `updateDraftSession` + writes audit row `EDIT_DRAFT_RESOLVE_CONFLICT`).

No schema change — reuses `schedules`, existing conflict-detection query.

---

## Feature 3 — Approval Feedback Chat (real-time, persistent)

Reuses existing `schedule_feedback_threads` / `schedule_feedback_messages` + `FeedbackChat` component (already realtime via Supabase channel).

**MA side** — in the redesigned Approvals page (`strategic/approvals.tsx`):
- "Return for Revision" opens the existing `RejectFeedbackDialog`; on submit calls `ma_decide_week` / `ma_reject_semester_with_feedback` (already creates thread + first message). After return, a **Discussion** column shows an unread badge and opens the chat in a side sheet.

**DH side** — in `operational/drafts.tsx` and `operational/index.tsx` alerts:
- Notification deep-links to `/operational/drafts?semester=<id>&week=<n>&chat=1` which auto-opens the chat sheet.
- New floating **Approval Discussion** dock component (`src/components/approval-chat-dock.tsx`): minimize / expand / close / reopen states persisted in `localStorage` keyed by thread id. Renders `FeedbackChat` inside.

All messages already persisted in `schedule_feedback_messages` — no schema change. Add `chat_state` URL param handling only.

---

## Feature 4 — Full editing after feedback

Already partially supported (DH can edit DRAFT sessions). Enhancements:
- When a week/semester is returned (`status=DRAFT` + active feedback thread), `operational/drafts.tsx` exposes full editor for: trainer, venue, module, section, date, start/end, week. Uses `updateDraftSession` (extend its zod patch to accept `trainer_registry_id`, `venue_id`, `module_id`, `section_id`, `week_num` — backend already permissive on DRAFT).
- Every save writes audit row `EDIT_DRAFT_AFTER_FEEDBACK` with before/after JSON (already done by triggerless audit insert in the server fn).

---

## Feature 5 — Resubmission loop

Already functions via `dh_resubmit_semester` / `dh_resubmit_week` ↔ `decide_approval` / `ma_decide_week`. Plan locks in the UX:
- On approval: schedules flip to LIVE (existing), UI re-renders cards as read-only with a green "Approved · Published" header. Edit buttons hidden.
- On return: cards unlock, chat dock auto-opens, banner "Awaiting your changes" with link to Drafts.
- Loop continues — no code change to the RPCs themselves, just UI states keyed on `schedules.status` + `approval_queue.decision`.

---

## Feature 6 — Approval History & Version Timeline

**No new tables.** Derive timeline from existing `approval_queue` (one row per submission, with `decision`, `decided_at`, `comment`) + `audit_logs` (`SUBMIT_FOR_APPROVAL`, `RESUBMIT_WEEK`, `APPROVE_WEEK`, `REJECT_WEEK_WITH_FEEDBACK`) + `schedule_feedback_messages`.

**New server fn:** `getApprovalHistory({ semester_id, week_num? })` returning ordered versions:
```
[{ version:1, submitted_at, submitted_by, returned_at?, returned_by?, feedback?, resubmitted_at?, decision, approval_id }, ...]
```

**New component:** `src/components/approval-version-timeline.tsx` — vertical timeline (V1 Submitted → Returned → V2 Resubmitted → … → Approved) embedded in:
- MA Approvals row detail.
- DH Drafts week detail.

**Version compare:** since schedule rows are mutated in place, snapshot each submission's schedule payload into a new lightweight table:

**Migration:** `public.approval_snapshots(id, approval_queue_id fk, semester_id, week_num, snapshot jsonb, created_at)` with GRANTs (`SELECT, INSERT` to `authenticated`, `ALL` to `service_role`), RLS: MA + DH-of-dept can SELECT; INSERT only via security-definer trigger on `approval_queue` INSERT that captures current schedule rows for the target week/semester. Compare view: side-by-side JSON diff (existing `diff` lib not needed — simple field-by-field render).

---

## Technical notes

- All new server fns use `createServerFn` + `requireSupabaseAuth`; `supabaseAdmin` only imported inside handlers for Feature 1.
- All destructive UIs require typed phrase + (Feature 1) password reverification; all writes append to `audit_logs`.
- One migration file: wipe RPCs + `approval_snapshots` + its trigger + grants/policies.
- Sidebar: append "System Data" under existing Strategic group only — no other sidebar changes.
- Existing approval RPCs, RLS, Cloud auth, and the Weekly Approvals redesign are untouched.

## Out of scope

- No new auth providers, no schema-wide refactor, no edge functions, no changes to attendance/session logic, no removal of any existing module.
