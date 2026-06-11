# Why "Approve" does nothing today

Two real problems, not one:

1. **MA → Approval Queue → Sessions tab.** The week-card Approve button is bound to `disabled={w.pending === 0}` and only the visible affordance changes (a grey "cleared" badge). The database currently has **zero** `approval_queue` rows of type `session` with `decision='pending'`, so every week renders disabled. Clicks are no-ops. Looks broken — is actually "nothing to approve".
2. **DH → Schedule Drafts.** The only submit action is **Request Semester Approval**, which creates one `approval_queue` row of type `semester`. That fills the **Semesters** tab on the MA queue, never the **Sessions** tab. To populate the Sessions tab the DH must submit per-week (RPC `dh_submit_semester_per_week` exists but is not wired into the Drafts page). Result: the MA opens the Sessions tab expecting weeks to approve and finds it empty.

The fix is both: the MA UI should explain emptiness, and the DH UI needs a per-week submit so weeks actually arrive.

# Changes

## 1. MA Approval Queue — Sessions tab empty-state polish
File: `src/routes/_authenticated/strategic/approvals.tsx` (`SessionApprovalsByDeptWeek`).

- When `weeks` is non-empty but `weeks.every(w => w.pending === 0)`: render the existing `EmptyState` component (icon, "No pending sessions in this department", subtitle "When the Department Head submits weeks for review, they appear here.", action button "Open Semesters tab" that calls a passed-in `onSwitchTab` prop).
- When `weeks` is empty: existing copy stays, but use `EmptyState` for consistency.
- For week cards where `pending === 0`: stop rendering Approve / Send back at all. Keep only **View** and a small `Badge variant="secondary">cleared</Badge>`.
- Keep the existing week dialog and bulk-decide flow exactly as is for weeks where `pending > 0`.
- Add a small instruction strip above the week grid when **any** pending semester-level row exists for this department: "There's also a semester-level approval pending — use the Semesters tab to either approve the whole semester or split it into weeks." Linked button switches `tab` to `"semester"`.
- Wire `onSwitchTab` from `ApprovalsPage` (`setTab`) down to `SessionApprovalsByDeptWeek`.

## 2. DH Schedule Drafts — per-week submission
File: `src/routes/_authenticated/operational/drafts.tsx`.

- Import `dhRequestApprovalPerWeek` from `@/lib/semester-drafts.functions`.
- Add a second submit mutation `submitPerWeekMut` calling that RPC; on success toast `"Submitted {created} weekly session(s) to Admin"`. If `created === 0`, toast.warning("Nothing new to submit — all sessions are already pending or live.").
- In each semester card header, render a small action cluster:
  - Primary: existing **Request Semester Approval** (`size="sm"`, secondary variant).
  - Primary (preferred): new **Submit by Week** button (`size="sm"`, default variant) — disabled when `canSubmit === false`. Tooltip: "Sends each week as an individual approval — Admin can approve week-by-week."
- Update the subtitle copy to: "Submit weeks individually (preferred) or submit the whole semester for one-shot approval."
- Refetch `["semester-drafts"]` after either submit (already wired for the semester path; mirror for per-week).

## 3. Status counts on MA Sessions tab refresh after submit
The realtime channel on `approval_queue` already invalidates `["approval-queue"]`, `["approvals-depts"]`, and `["approvals-weeks"]` (line 47-56 of approvals.tsx). No change needed — once the DH submits per week, the MA tab updates live.

# Out of scope
- No changes to RLS, RPCs, `decide_approval`, `ma_decide_week`, or any server function.
- No changes to the Semesters tab, Feedback chat, week-timetable dialog, or DH dashboard leave approvals.
- No new database migration.

# Technical notes
- `EmptyState` already exists at `src/components/erp/empty-state.tsx`; reuse it.
- `dh_submit_semester_per_week` RPC returns `{ created: number }` and is already wrapped by `dhRequestApprovalPerWeek` in `src/lib/semester-drafts.functions.ts` — only UI wiring is needed.
- Tooltip uses existing `@/components/ui/tooltip`.
