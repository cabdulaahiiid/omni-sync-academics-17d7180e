# Fix: Approval workflow is broken at the database level

## Root cause

Inspected the live data and schema:

- `semester_registry`: 1 row, `distribution_status = DRAFT`
- `schedules`: 60 rows, all `DRAFT` / `is_published=false`
- `approval_queue`: **0 rows** — nothing has ever been successfully submitted

The buttons render and the mutations fire, but the underlying RPC fails silently/with an error toast because of a schema mismatch:

```
approval_queue.schedule_id  uuid  NOT NULL
```

But `submit_for_approval('semester', …)` does:

```sql
INSERT INTO approval_queue(type, target_id, schedule_id, …)
VALUES ('semester', v_id, NULL, …)   -- ❌ NOT NULL violation
```

So:

1. **DH** clicks *Request Semester Approval* → `submit_for_approval` throws `null value in column "schedule_id"` → nothing reaches the queue.
2. **MA Semesters tab** is therefore always empty → Approve/Reject buttons appear to "do nothing" because there's nothing to act on.
3. **MA Sessions tab** weekly cards show `0 pending` for the same reason (no session-level submissions either, because the DH flow only ever submits at the semester level).

A secondary issue: the DH RLS policy on `approval_queue` joins through `schedule_id`, so even if semester rows existed, a DH would never see them. MA sees all, so this is cosmetic for now but worth fixing.

## Fix

Single migration:

1. `ALTER TABLE public.approval_queue ALTER COLUMN schedule_id DROP NOT NULL;`
2. Add a CHECK so session-type rows still require `schedule_id`:
   `CHECK ((type = 'session' AND schedule_id IS NOT NULL) OR (type = 'semester'))`
3. Update the DH SELECT policy on `approval_queue` so semester rows are visible to the DH of the owning department (join through `semester_registry → schedules.department_id`).
4. Backfill no rows needed — queue is empty.

No frontend changes are required. The existing buttons, mutations, dialogs, and `decide_approval` RPC already handle both `session` and `semester` correctly once rows can be inserted.

## Verification after migration

1. As DH, open **Operational → Drafts**, click *Request Semester Approval* → toast "Semester sent to Admin for approval".
2. As MA, open **Strategic → Approvals → Semesters** → the semester appears.
3. Approve → schedules flip to `LIVE`, `is_published=true`; trainer dashboard now shows sessions.
4. Reject (with feedback) → status returns to `FEEDBACK_ACTIVE`, chat thread opens.

## Files touched

- New migration under `supabase/migrations/` (schema + policy only).
- No application code changes.
