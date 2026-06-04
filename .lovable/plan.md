
# Finish Semester Approval Workflow — Remaining Items

The migration, Excel upload + conflict validation, drafts page, and state machine are already in. Four pieces from the original plan remain.

## 1. Weekly Matrix extension (`operational/matrix.tsx`)
- Add `semesterId` selector (from `listSemesters`) and `week_num` selector alongside the existing dept filter.
- Render grid: rows = trainers, columns = MON–SAT, cells = sessions for that week.
- Highlight cells red when the same trainer/venue/section appears in overlapping slots (client-side conflict detection over the fetched week).
- Reuse existing `getWeeklyMatrix` server fn if present; otherwise add a thin `listWeekSessions({semester_id, week_num, department_id})` in `semester-drafts.functions.ts`.

## 2. Admin "Send back" modal (`strategic/approvals.tsx`)
- Replace the current send-back action with a Dialog containing a required Textarea (min 5 chars).
- On submit → call `maRejectSemesterWithFeedback({semester_id, comment})` (already wired in `feedback.functions.ts`), which flips `distribution_status='FEEDBACK_ACTIVE'` and seeds the chat thread.
- Toast + invalidate approvals query.

## 3. FeedbackChat inline editor (`components/feedback-chat.tsx`)
- When parent semester `distribution_status === 'FEEDBACK_ACTIVE'`, render an editable session list below the chat: date, start/end, venue, trainer (read-only labels with inline inputs for time/date/venue/trainer dropdowns).
- Save per-row via `updateDraftSession` (already exists).
- "Re-submit for Approval" button at the bottom → `dhResubmitSemester`.
- Hidden in PENDING_MA / PUBLISHED.

## 4. Trainer dashboard publish gate (`ground/index.tsx`)
- Add `.eq('is_published', true)` to every `schedules` query so DRAFT / PENDING never leak into the trainer view.
- Quick audit of `trainer.functions.ts` for the same filter (already updated earlier — confirm).

## Files touched
- Edit: `src/routes/_authenticated/operational/matrix.tsx`
- Edit: `src/routes/_authenticated/strategic/approvals.tsx`
- Edit: `src/components/feedback-chat.tsx`
- Edit: `src/routes/_authenticated/ground/index.tsx`
- Possibly add: `listWeekSessions` in `src/lib/semester-drafts.functions.ts`

No schema, no new routes, no new dependencies. Approve to implement.
