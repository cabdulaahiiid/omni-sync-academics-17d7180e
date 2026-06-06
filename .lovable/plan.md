# Activate MA Weekly Approval + Feedback

The Admin → Approvals → Sessions tab already renders the Department → Week grid with **View**, **Approve**, **Send back** buttons, but the underlying flow is incomplete:

- `decideWeek` only calls `decide_approval` per row. Rejection silently sets sessions back to DRAFT — no feedback message, no chat thread, no DH notification with the reason, no audit comment.
- DHs have no per-week feedback inbox to see why a week was sent back, edit, and resubmit. They only see semester-level feedback today.

This plan wires the week-level **Approve** and **Send back with feedback** end-to-end, mirroring the existing semester feedback pattern.

## What gets built

### 1. New RPC: `ma_decide_week`
Replaces the per-row loop in `decideWeek`.

- Args: `_department_id uuid, _week_num int, _decision approval_decision, _message text`
- MA-only guard.
- **Approve**: loops pending `approval_queue` rows for that dept+week, calls existing `decide_approval` logic (status → LIVE, `is_published=true`, notifies DH + assigned trainers, audit `APPROVE_WEEK`).
- **Reject (Send back)**:
  - Requires non-empty `_message`.
  - For each pending session: marks `approval_queue.decision='rejected'` with comment, sets `schedules.status='DRAFT'`.
  - Upserts a feedback thread keyed on the **semester_id** of those schedules (reuse `schedule_feedback_threads`, add `week_num` column nullable so multiple per semester can coexist) and inserts the message prefixed `Week N feedback: …`.
  - Notifies the DH (`Week N sent back for changes`).
  - Audit `REJECT_WEEK_WITH_FEEDBACK` with `{week_num, message}`.

### 2. Migration
- `ALTER TABLE schedule_feedback_threads ADD COLUMN week_num int NULL;`
- Drop existing unique constraint on `(semester_id)` and replace with unique `(semester_id, COALESCE(week_num,-1))` so semester-level (NULL) and per-week threads can coexist.
- Update RLS policies on `schedule_feedback_threads` / `messages` to keep current DH/MA visibility (no scope change).
- Create the new `ma_decide_week` function above; `GRANT EXECUTE ... TO authenticated`.

### 3. Server function changes
- `src/lib/approvals.functions.ts → decideWeek`: replace per-row loop with a single `supabase.rpc('ma_decide_week', …)` call. Add required `message` field when decision is `rejected` (validated with Zod `min(3)`).
- `src/lib/feedback.functions.ts`: add `listWeekThreadsForDept({ department_id })` and `getThreadForWeek({ semester_id, week_num })` for the DH inbox.

### 4. Admin UI (`strategic/approvals.tsx`)
- The existing "Decide-week dialog" already collects a comment. Keep it; just pass it through as `message`. Disable Approve button while pending. Reject already validates `>=3` chars — leave as is.
- After success, toast already shows count; also invalidate `["approval-queue"]` so the Semesters tab stays fresh.

### 5. DH UI (`operational/drafts.tsx`)
- Add a "Week feedback" section above the drafts list listing rows from `listWeekThreadsForDept`, each opening the existing `<FeedbackChat>` component (extended to accept `weekNum` and render that week's thread instead of the semester-level thread).
- Existing "Re-submit for Approval" button in `FeedbackChat` already calls `dh_resubmit_semester`. Extend with a sibling `dh_resubmit_week` RPC that re-queues only that week's PENDING_MA rows; wire a "Resubmit Week N" button when `weekNum` is set.

### 6. Realtime
- `approvals.tsx` already subscribes to `approval_queue` + `semester_registry`. Add `schedule_feedback_messages` so the Admin chat updates live.
- `drafts.tsx` already subscribes to `schedules` + `semester_registry`. Add `schedule_feedback_threads` filtered by `department_id` so new week-feedback rows appear instantly for DHs.

## Out of scope (unchanged)
- Semester-level approval, rejection-with-feedback, and chat — already working from the previous turn.
- Session-level single-row decisions (no current entry point uses them).
- All trainer-side, attendance, and reporting flows.

## Acceptance test

1. DH submits Week 3 of Semester X for approval.
2. MA → Approvals → Sessions → picks dept → **Send back** on Week 3 with message "Move Tuesday class to Wed".
3. DH gets notification + sees a "Week 3 feedback" card on Drafts, opens chat, sees message, edits sessions, clicks **Resubmit Week 3**.
4. Row re-appears in MA queue as pending; MA clicks **Approve all** → sessions flip to LIVE, `is_published=true`, DH + assigned trainers receive notifications, audit entries written.
