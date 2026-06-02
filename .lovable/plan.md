# Semester Approval Workflow & Conflict Prevention

## 1. Database Migration

Add publication + edit-lock + chat-link state to schedules / semester:

```sql
ALTER TABLE schedules
  ADD COLUMN is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN published_at timestamptz,
  ADD COLUMN published_by uuid;

ALTER TABLE semester_registry
  ADD COLUMN distribution_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (distribution_status IN ('DRAFT','PENDING_MA','FEEDBACK_ACTIVE','PUBLISHED'));
-- DH may only edit schedules when parent semester is FEEDBACK_ACTIVE.

-- Conflict-prevention indexes (read-side; insert validates in app)
CREATE INDEX IF NOT EXISTS schedules_conflict_trainer
  ON schedules(trainer_registry_id, date, start_time, end_time);
CREATE INDEX IF NOT EXISTS schedules_conflict_venue
  ON schedules(venue_id, date, start_time, end_time);
CREATE INDEX IF NOT EXISTS schedules_conflict_section
  ON schedules(section_id, date, start_time, end_time);
```

RLS additions:
- Trainer `schedules T self` policy gains `AND is_published = true` so drafts stay invisible until MA publishes.
- DH update on `schedules` requires `EXISTS (semester_registry sr WHERE sr.id = semester_id AND sr.distribution_status = 'FEEDBACK_ACTIVE')`.

Function tweaks:
- `decide_approval` (approved/session) → also set `is_published=true, published_at=now(), published_by=auth.uid()` and set `semester_registry.distribution_status='PUBLISHED'`.
- `ma_reject_semester_with_feedback` → set `distribution_status='FEEDBACK_ACTIVE'` (instead of just DRAFT).
- `dh_resubmit_semester` → set `distribution_status='PENDING_MA'`.

## 2. Server Functions

**`src/lib/dh-extras.functions.ts` — replace `uploadSemesterSchedule`:**
- Add `validate` flag. First pass:
  1. Resolve names → ids (existing).
  2. Generate prospective rows in-memory.
  3. Detect intra-batch conflicts (trainer / venue / section overlap).
  4. Detect DB conflicts: query `schedules` for same (trainer/venue/section, date, overlapping time) excluding self-semester drafts.
  5. If ANY conflict OR FK error → return `{ ok:false, conflicts:[...], errors:[...] }` and insert NOTHING.
- Only on `ok` do we insert; default `status='DRAFT'`, `is_published=false`. Do NOT auto-create approval rows.

**New `src/lib/semester-drafts.functions.ts`:**
- `listSemesterDrafts({department_id})` → semesters with weeks grouped, counts per week, `distribution_status`.
- `requestSemesterApproval({semester_id, week_nums?})` → calls `submit_for_approval('semester', [id])` (or per-week sessions if `week_nums` given), flips `distribution_status='PENDING_MA'`.
- `updateDraftSession({schedule_id, patch})` — gated by RLS (only FEEDBACK_ACTIVE).

## 3. UI Changes

### `operational/semester-upload.tsx` (DH)
- Replace textarea + `parseCSV` with Excel dropzone (reuse `csv-dropzone.tsx`, add `xlsx` parser via `bun add xlsx`).
- Show parsed preview table.
- "Validate" button → calls upload fn with `validate:true`; renders conflict report (trainer/venue/section badges with offending pair).
- "Save as Draft" enabled only when validation passes; on success → toast + link to Draft List.

### New `operational/drafts.tsx` (DH)
- Table of semesters → expandable per-week rows (`week_num`, session count, status badge).
- Checkboxes per week + "Request Semester Approval" bulk button.
- Per-row "Open Matrix" → opens `WeeklyMatrix` modal.

### New `operational/matrix.tsx` already exists — extend
- Add `semesterId` filter and week selector. Render grid: rows = trainers, columns = days, cells = sessions with conflict highlight (reuse `getWeeklyMatrix`).

### `strategic/approvals.tsx` (MA) — small additions
- "Send back" button → modal with required comment → calls `ma_reject_semester_with_feedback` → sets FEEDBACK_ACTIVE and opens chat thread (already wired).
- "Approve" calls `decide_approval` (now also publishes).

### DH feedback portal
- `FeedbackChat` already present in semester-upload. Add inline editable session list inside the chat panel — visible only when `distribution_status='FEEDBACK_ACTIVE'`. "Re-submit for Approval" button at bottom calls `dhResubmitSemester`.

### Trainer dashboard (`ground/index.tsx`)
- Already queries `schedules`. Add `.eq('is_published', true)` so DRAFT/PENDING never appear.

## 4. State Machine

```text
DRAFT ──(DH: Request Approval)──▶ PENDING_MA
PENDING_MA ──(MA: Send back+comment)──▶ FEEDBACK_ACTIVE  (chat open, DH can edit)
FEEDBACK_ACTIVE ──(DH: Re-submit)──▶ PENDING_MA
PENDING_MA ──(MA: Approve)──▶ PUBLISHED  (is_published=true, trainers see it)
```

`is_editable = (distribution_status === 'FEEDBACK_ACTIVE')` enforced in RLS + UI.

## 5. Build Order
1. Migration (schema + RLS + function tweaks).
2. `bun add xlsx`.
3. Rewrite `uploadSemesterSchedule` with validation/conflict guard.
4. New `semester-drafts.functions.ts`.
5. UI: Excel upload, Drafts page, Matrix extension, Approvals modal, FeedbackChat editor.
6. Trainer dashboard `is_published` filter.

## Impact Analysis
- **Affected**: `schedules`, `semester_registry`, `decide_approval`, `ma_reject_semester_with_feedback`, `dh_resubmit_semester`, `uploadSemesterSchedule`, `semester-upload.tsx`, `approvals.tsx`, `ground/index.tsx`, `FeedbackChat`, `strategic-shell` / `operational` nav (new Drafts link).
- **Not affected**: trainer attendance flow, venues/levels/sections/modules CRUD, dashboard insights.

Approve to proceed with the migration as step 1.