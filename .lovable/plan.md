## Goal
Allow Master Admin (MA) to delete schedules in **any** status — Draft, Pending Approval, and Approved/Live/Ended — directly from the app. Today only DH can delete, and only when status = DRAFT (`dh_delete_draft_session`).

## Backend (migration)
Add a new security-definer RPC `public.ma_delete_schedule(_schedule_id uuid, _reason text)`:
- Reject if caller is not MA (`has_role(auth.uid(),'MA')`).
- Require a non-empty `_reason` (≥3 chars) for audit accountability.
- Cleanup in FK-safe order inside one transaction:
  1. `attendance_overrides` rows linked to this schedule's `attendance_logs`
  2. `attendance_logs` for the schedule
  3. `session_logs` for the schedule
  4. `pending_sync` rows for the schedule
  5. `schedule_feedback_messages` → `schedule_feedback_threads` tied to this schedule (week-scoped threads only — semester threads are left intact)
  6. `approval_queue` rows where `schedule_id = _schedule_id` or `target_id = _schedule_id AND type='session'`
  7. `schedules` row itself
- Notify the assigned trainer (if any) via `notifications`: "Schedule removed by admin — <reason>".
- Insert an `audit_logs` row (`action_type = 'MA_DELETE_SCHEDULE'`, before_state = snapshot of the schedule, after_state = `{reason}`).
- Temporarily disable the `enforce_schedule_transition` issue: it only fires on UPDATE, so DELETE is unaffected — no extra work.

## Server function
`src/lib/ma.functions.ts` → add `deleteSchedule` server fn:
- `requireSupabaseAuth` + `requireRole(["MA"], "deleteSchedule")`.
- Input: `{ id: uuid, reason: string (min 3, max 500) }`.
- Calls `rpc("ma_delete_schedule", ...)`.

## UI
1. **Approvals page** (`src/routes/_authenticated/strategic/approvals.tsx`)
   - In the session approvals table rows (pending/approved/rejected), add a small destructive "Delete" icon button next to the existing actions. Visible only to MA (which is the page audience already).
   - Confirmation dialog reusing `RejectFeedbackDialog` styling — requires a reason. On success: `qc.invalidateQueries(["approval-queue","schedules"])`, toast.

2. **Live Monitor** (`src/routes/_authenticated/operational/live-monitor.tsx`) — gated to MA only
   - Add per-row "Delete" button on each schedule (any status), with the same reason dialog. This is the natural place to remove an Approved/Live/Ended schedule.

3. **DH Drafts page** is untouched (DH already has draft delete).

## Audit & realtime
- The existing `useLiveTables(["approval_queue","schedules"], …)` subscriptions already refresh the UI on delete (Supabase emits DELETE events on those tables).

## Out of scope
- No bulk-delete UI in this pass (single-row only).
- No edit-then-delete; semester-level deletes remain a separate flow.
- No change to DH permissions — DH still limited to DRAFT.

## Acceptance
- MA can delete a schedule in DRAFT, PENDING_MA, LIVE, ACTIVE, or ENDED state with a required reason.
- Related attendance/session/feedback/approval rows are cleaned up; no orphan FK errors.
- Trainer receives a notification when their published schedule is deleted.
- `audit_logs` records actor, schedule snapshot, and reason.
- Non-MA callers receive 403 from both the server fn and the RPC.