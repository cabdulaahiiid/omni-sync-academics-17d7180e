# Clickable session/week drilldowns + post-upload approval choice

Adds the missing UI pathways requested without touching working features. Reuses existing server fns and RPCs (`getWeekTimetable`, `ma_decide_week`, `ma_reject_semester_with_feedback`, `ma_split_semester_to_weeks`, `requestSemesterApproval`).

## 1. Trainer dashboard — clickable session cards (`src/routes/_authenticated/ground/index.tsx`)

- Keep current cards & links to per-schedule check-in.
- Add **two new clickable stat cards** ("Today's Sessions" and "Upcoming") above the existing list. Click → open a `Dialog` with a `<Table>` of: Module code, Module name, Section, Venue, Date, Start–End.
- New server fn `getTrainerSessionsDetailed({ scope: 'today'|'upcoming' })` in `src/lib/trainer.functions.ts` — wraps existing schedule query joined with `venues.name`, `sections.name`. Uses `requireSupabaseAuth`.
- No removal of existing `Stat` cards; promotes them to `<button>` triggers.

## 2. DH Schedule Builder — clickable weeks (`src/routes/_authenticated/operational/drafts.tsx`)

- Wrap each Week tile in a button → opens `Dialog` showing that week's full timetable.
- New shared component `<WeekTimetableDialog semesterId weekNum/>` that calls a new server fn `getSemesterWeekTimetable({ semester_id, week_num })` (joins schedules + venues + sections + trainer_registry).
- "Recent Week Activity" list (rendered from the existing week thread inbox) gets the same click → opens the same dialog (semester_id + week_num are already on each thread row).

## 3. Post-upload workflow modal (`src/routes/_authenticated/operational/semester-upload.tsx`)

- After `saveDraftMut` succeeds, open a `Dialog` with two buttons:
  - **Request Approval for Full Semester** → calls existing `requestSemesterApproval({ semester_id })`.
  - **Request Approval by Week** → calls existing `requestSemesterApproval` then immediately a new helper `dhRequestApprovalPerWeek({ semester_id })` server fn that wraps a new RPC `dh_submit_semester_per_week` (creates `approval_queue` rows of type `session` for every schedule and sets them `PENDING_MA`, skipping if a pending row exists). Same UX as MA's `ma_split_semester_to_weeks` but originated by DH at submit time.
- Both routes navigate to `/operational/drafts` on success.

## 4. Admin approvals — granular weekly view per dept card (`src/routes/_authenticated/strategic/approvals.tsx`)

The Sessions tab already has the per-dept/per-week interface. Extend the **Semester tab** so each department's pending semester card includes:

- **View Weekly Timetable** toggle: expands into the same week grid used in the Sessions tab (reuse `listPendingWeeksForDept` + `getWeekTimetable`, filtered by that semester's department_id).
- **Approve Full Semester** button (existing `decide_approval` flow).
- **Approve by Week** button → calls existing `ma_split_semester_to_weeks` then opens the weekly grid for that dept.
- Within each expanded week row: existing **Approve** / **Send back (with feedback)** buttons from `SessionApprovalsByDeptWeek` already cover "Reject" + "Provide Feedback" requirements; ensure they're reachable in the new expanded layout.

## 5. Backend additions (one migration)

```sql
-- dh_submit_semester_per_week: DH-initiated per-session approval queue
CREATE OR REPLACE FUNCTION public.dh_submit_semester_per_week(_semester_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dept uuid; v_created int := 0; v_sched record;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id=_semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;
  FOR v_sched IN SELECT id FROM public.schedules
    WHERE semester_id=_semester_id AND status IN ('DRAFT','PENDING_MA')
      AND NOT EXISTS (SELECT 1 FROM public.approval_queue aq
        WHERE aq.type='session' AND aq.schedule_id=schedules.id AND aq.decision='pending')
  LOOP
    INSERT INTO public.approval_queue(type,target_id,schedule_id,submitted_by,decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_created := v_created+1;
  END LOOP;
  UPDATE public.schedules SET status='PENDING_MA'
    WHERE semester_id=_semester_id AND status='DRAFT';
  -- Notify all MAs
  INSERT INTO public.notifications(recipient_id,title,body)
  SELECT ur.user_id,'Per-week approval submitted',
         'DH submitted '||v_created||' weekly session(s) for review.'
    FROM public.user_roles ur WHERE ur.role='MA';
  RETURN jsonb_build_object('created', v_created);
END $$;
```

No table or RLS changes.

## 6. New / edited files

- **NEW** `supabase/migrations/<ts>_dh_submit_per_week.sql`
- **NEW** `src/components/week-timetable-dialog.tsx`
- **EDIT** `src/lib/trainer.functions.ts` — add `getTrainerSessionsDetailed`
- **EDIT** `src/lib/dh-extras.functions.ts` (or new `dh-submit.functions.ts`) — add `getSemesterWeekTimetable`, `dhRequestApprovalPerWeek`
- **EDIT** `src/routes/_authenticated/ground/index.tsx` — clickable stat cards + dialog
- **EDIT** `src/routes/_authenticated/operational/drafts.tsx` — clickable week tiles + clickable thread rows use new dialog
- **EDIT** `src/routes/_authenticated/operational/semester-upload.tsx` — post-save workflow modal
- **EDIT** `src/routes/_authenticated/strategic/approvals.tsx` — Semester tab cards gain "View Weekly Timetable" toggle, "Approve by Week" button reusing existing splitMut + weekly grid

## Out of scope (preserved as-is)

- Existing trainer check-in flow, schedule transitions, RLS, attendance logic, sessions tab weekly grid, FeedbackChat behavior, all other working features.
