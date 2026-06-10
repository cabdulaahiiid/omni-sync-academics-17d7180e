# Standardize Approval Workflow UI

Promote the existing `/strategic/approvals` Approval Queue pattern (Approve + Reject-with-required-feedback dialog + conflict badges + comment field) to a single reusable interface used everywhere approvals happen.

## Scope

**Canonical reference (unchanged):** `src/routes/_authenticated/strategic/approvals.tsx`. Its `ApprovalRow` + reject-with-feedback dialog define the standard.

**Surfaces that currently diverge and need to adopt the standard:**

1. **MA dashboard — `src/routes/_authenticated/strategic/index.tsx`**
   - "Approval Queue" card currently renders inline `Approve` + `Send back` buttons with a custom send-back dialog (lines 220–240, 370–385).
   - Replace the inline action cluster with a shared `<ApprovalActions>` component (Approve immediate / Reject opens shared feedback dialog requiring ≥3 chars). Keep the existing `approveSchedule` and `sendBackSchedule` server calls — only the UI changes.

2. **DH dashboard — `src/routes/_authenticated/operational/index.tsx`**
   - "Trainer Leave" row currently shows only a bare `Approve` button (line 168–170) with no Reject path.
   - Replace with the same `<ApprovalActions>` cluster (Approve / Reject-with-feedback) wired to `decideLeaveRequest({ id, decision: "APPROVED"|"REJECTED", reason })`. Add the optional `reason` field to the existing server fn signature only if not already supported; otherwise pass via existing parameter. (Confirmed reject already supported; reason becomes a comment param if available.)

## New shared components

- `src/components/erp/approval-actions.tsx` — the canonical action cluster:
  - Props: `onApprove(comment) => Promise|void`, `onReject(feedback) => Promise|void`, `isPending`, optional `approveLabel`, optional `rejectLabel`, optional `entityName` (for dialog title), optional `disabled`.
  - Renders: green Approve button (immediate), outline Reject button. Reject opens the shared `<RejectFeedbackDialog>`. Approve uses an optional inline comment input or popover.
  - Visual style matches the existing `ApprovalRow` buttons (same sizes, same destructive variant, same spacing).

- `src/components/erp/reject-feedback-dialog.tsx` — extracted from the existing reject dialog in `approvals.tsx`:
  - Required feedback text (≥3 chars), Cancel + "Send feedback & reject" (destructive) buttons, helper copy explaining the recipient will be notified.
  - Controlled `open`, `onOpenChange`, `entityName`, `onSubmit(message)`, `isPending`.

- `src/components/erp/conflict-badges.tsx` — extracted from the inline `<Badge>` cluster in both `approvals.tsx` and `strategic/index.tsx`:
  - Props: `{ trainer?, venue?, qualification?, load? }` booleans → renders normalized destructive badges.

## Wiring

1. Create the three components.
2. `approvals.tsx`: replace the inline reject dialog + inline conflict badges with the new components (visual parity, no logic change). The existing `ApprovalRow` keeps its current Approve/Reject buttons but now uses `<ApprovalActions>` and `<ConflictBadges>` internally.
3. `strategic/index.tsx` (MA dashboard "Approval Queue" card): replace inline Approve / Send back buttons + custom send-back dialog with `<ApprovalActions>` and the shared `<RejectFeedbackDialog>`. Existing `approveSchedule(id)` and `sendBackSchedule(id, feedback)` mutations stay; only the UI wrappers change. The local `feedbackTarget` / `feedbackText` state and custom dialog are removed.
4. `operational/index.tsx` (DH dashboard leave card): replace the single Approve button with `<ApprovalActions>` wired to `decideLeaveRequest`. Reject submits `{ id, decision: "REJECTED" }` plus optional reason. If `decideLeaveRequest` doesn't currently accept a reason, pass it as `comment` only when the server fn schema supports it; otherwise just submit the decision and surface the typed feedback as a toast/notification message (no server-fn change in this cycle).

## Explicitly out of scope

- All server functions (`approveSchedule`, `sendBackSchedule`, `decideApproval`, `decideWeek`, `maRejectSemesterWithFeedback`, `decideLeaveRequest`), RLS, RPCs, audit logs, realtime channels — unchanged.
- Week-level approval and DH schedule builder (already canonical from prior cycle).
- Trainer-facing screens — no approval actions.

## Files to add
- `src/components/erp/approval-actions.tsx`
- `src/components/erp/reject-feedback-dialog.tsx`
- `src/components/erp/conflict-badges.tsx`

## Files to edit (UI only)
- `src/routes/_authenticated/strategic/approvals.tsx` — use the new shared components for visual parity (no logic change).
- `src/routes/_authenticated/strategic/index.tsx` — replace inline approval action cluster + custom send-back dialog.
- `src/routes/_authenticated/operational/index.tsx` — replace single Approve button with the standard Approve/Reject cluster.
