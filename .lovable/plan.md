# Week Feedback Workspace — Unified Chat + Edit Modal

## Goal
Replace the two separate dialogs (`FeedbackChat` panel + `WeekTimetableDialog`) with **one** "Week Feedback Workspace" modal that opens from every "Open Chat" / week-feedback alert. It must give the DH a chat thread *and* a full CRUD edit surface for that week's schedule side-by-side, with a clear status-driven Resubmit loop.

Scope is **frontend + composition only**. No DB, RLS, RPC, or server-function changes — all required server functions already exist (`getThreadForSemester`, `replyFeedback`, `getSemesterWeekTimetable`, `updateDraftSession`, `dhDeleteDraftSession`, `dhResubmitWeek`, plus venues/trainers lookups).

## 1. New component: `WeekFeedbackWorkspace`
File: `src/components/week-feedback-workspace.tsx`

Props: `{ open, onOpenChange, semesterId, weekNum, title }`.

Shell: shadcn `Sheet` (right side, `w-full sm:max-w-5xl`) so it works as a drawer on desktop and full-screen on mobile — avoids the layout-break risk of a tall `Dialog` on small viewports.

Header row:
- Title: "{semester} · Week N — Feedback"
- Status pill from the week's aggregate schedule status (DRAFT / PENDING_MA / LIVE / FEEDBACK_ACTIVE) using existing `StatusBadge` tokens (amber for pending/needs-edit, green for approved/LIVE, neutral for draft).
- Right-aligned primary button: **Resubmit to Admin** (disabled unless at least one session is DRAFT and week is not already PENDING_MA/LIVE).

Body: shadcn `Tabs` with two tabs, `Chat` (default) and `Edit timetable`. On `lg:` breakpoint, render both panels side-by-side (split-screen) instead of tabs, using the same child components — so the DH can read Admin feedback while editing. Tabs remain the mobile fallback.

### Chat panel
Reuse the message rendering + composer from the current `FeedbackChat` component, but extracted into a presentational `<FeedbackThreadPanel semesterId weekNum />`:
- Scrolling bubble history (mine = primary, theirs = muted), timestamps, auto-scroll on new message.
- Realtime subscription to `schedule_feedback_messages` filtered by `thread_id` (already implemented).
- Persistent `Textarea` + Send at the bottom, sticky inside the panel.
- Empty state if no thread yet (Admin hasn't sent feedback): show muted helper "No feedback from Admin yet for this week."

### Edit timetable panel
Reuse the table + inline EditRow from `WeekTimetableDialog`, extracted into `<WeekTimetableEditor semesterId weekNum />`:
- Full CRUD on DRAFT sessions: edit date/time/venue/trainer (existing `EditRow`), delete (existing `dhDeleteDraftSession`).
- Add "+ New session" button (DH-only) that opens an inline create row → calls existing `dhCreateDraftSession` if present; if not, scope to U/D only in this iteration and surface a TODO note in the plan (verify during build).
- Locked-state visualization: rows whose `status !== 'DRAFT'` render read-only with a small lock icon and a tooltip ("Locked — already submitted / approved"). Edit/Delete buttons disabled, matching current behavior.
- Footer helper: "Edits saved here become a new draft version for Week N. They go live only after you Resubmit and Admin approves."

### Resubmit action (state loop)
Single button in the header. Confirms with a small popover ("Resubmit N draft sessions for Admin review?") then calls existing `dhResubmitWeek({ semester_id, week_num })`. On success:
- Toast "Week N resubmitted".
- Invalidate `["semester-week-timetable", semesterId, weekNum]`, `["feedback-thread", …]`, `["dh-week-threads", …]`, and the operational dashboard queries.
- Status pill flips to PENDING_MA; Edit panel auto-locks (all rows now PENDING_MA, so existing per-row disable logic takes over). Chat thread + history are preserved (server keeps the thread row).
- If Admin later rejects, server reopens FEEDBACK_ACTIVE and rows return to DRAFT → workspace becomes editable again with chat history intact. No client work needed beyond reading the live status.

## 2. Wire-up
Replace the two separate triggers in `src/routes/_authenticated/operational/drafts.tsx`:
- Drop `openThread` state and the `FeedbackChat` block.
- Drop `openWeek` state and the `WeekTimetableDialog` block.
- Add one `openWorkspace: { semester_id, week_num, title } | null` state and one `<WeekFeedbackWorkspace …/>`.
- Both the "Open chat" button and the per-week tile click route through `setOpenWorkspace(...)`.

Also update other entry points that currently launch chat or edit dialogs:
- `src/routes/_authenticated/operational/matrix.tsx` — swap any "Open chat" / "Edit week" buttons to open the workspace.
- `src/routes/_authenticated/operational/index.tsx` — the Week Feedback alert row's "Open Chat" CTA opens the workspace at the right week.

Leave the existing `FeedbackChat` component file in place for now (it's still imported in places like `strategic/approvals.tsx`) but mark its DH-edit branch as superseded in a code comment; full removal can come in a follow-up once all call sites migrate.

## 3. Visual states (dashboard-wide consistency)
Use existing tokens via `StatusBadge`:
- `LIVE` / approved → green (`bg-emerald-…` token already in `status-badge.tsx`).
- `PENDING_MA` → amber.
- `DRAFT` with active feedback thread → amber "Needs edit".
- `DRAFT` clean → neutral.

Apply the same badge in: workspace header, week tiles in `drafts.tsx`, week rows in `operational/index.tsx`, and matrix week chips. No new color tokens — reuse `StatusBadge` variants only.

## 4. Responsiveness
- `Sheet` side="right" with `w-full sm:max-w-5xl`, body `flex flex-col h-full overflow-hidden`.
- Chat panel and Edit panel each `min-h-0 flex-1 overflow-y-auto`; composer / Resubmit button stay sticky (no growing-modal bug with long threads).
- `<lg`: `Tabs` (single column). `lg:`: two-column grid `grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`, chat left / editor right.

## What is explicitly NOT changing
- No DB schema, RLS, RPC, or grants.
- No server functions added or modified.
- No changes to approval-decision logic, audit logs, notifications, or realtime tables list.
- Existing `FeedbackChat` and `WeekTimetableDialog` files stay on disk during this pass; only their call sites in operational routes are replaced.

## Files
**New:** `src/components/week-feedback-workspace.tsx`, `src/components/week-feedback/feedback-thread-panel.tsx`, `src/components/week-feedback/week-timetable-editor.tsx`.
**Edited:** `src/routes/_authenticated/operational/drafts.tsx`, `src/routes/_authenticated/operational/matrix.tsx`, `src/routes/_authenticated/operational/index.tsx`.

## Acceptance check (manual, post-build)
1. As DH, click "Open Chat" on a Week Feedback alert → workspace sheet opens with chat + edit visible (split on desktop, tabbed on mobile).
2. Send a reply → appears instantly; realtime delivers to MA's open session.
3. Edit a DRAFT session's time/venue/trainer → saves; row updates.
4. Click "Resubmit to Admin" → toast, status flips to PENDING_MA, all rows lock, chat history retained.
5. MA rejects with feedback → DH reopens workspace, sees full prior chat + new message, rows DRAFT again and editable.
6. MA approves → status flips green LIVE, edit controls stay locked, chat remains read-only-visible.
