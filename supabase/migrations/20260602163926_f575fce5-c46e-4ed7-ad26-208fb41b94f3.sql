-- Publication & distribution lock
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

ALTER TABLE public.semester_registry
  ADD COLUMN IF NOT EXISTS distribution_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (distribution_status IN ('DRAFT','PENDING_MA','FEEDBACK_ACTIVE','PUBLISHED'));

CREATE INDEX IF NOT EXISTS schedules_conflict_trainer
  ON public.schedules(trainer_registry_id, date, start_time, end_time);
CREATE INDEX IF NOT EXISTS schedules_conflict_venue
  ON public.schedules(venue_id, date, start_time, end_time);
CREATE INDEX IF NOT EXISTS schedules_conflict_section
  ON public.schedules(section_id, date, start_time, end_time);

-- Trainer visibility: only published schedules
DROP POLICY IF EXISTS "schedules T self" ON public.schedules;
CREATE POLICY "schedules T self" ON public.schedules
  FOR SELECT TO authenticated
  USING (trainer_registry_id = current_trainer_registry_id() AND is_published = true);

-- Update decide_approval to publish on approve
CREATE OR REPLACE FUNCTION public.decide_approval(_id uuid, _decision approval_decision, _comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row approval_queue;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT * INTO v_row FROM approval_queue WHERE id = _id;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  UPDATE approval_queue
    SET decision = _decision, decided_by = auth.uid(), decided_at = now(), comment = _comment
    WHERE id = _id;

  IF _decision = 'approved' THEN
    IF v_row.type = 'session' THEN
      UPDATE schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE semester_registry SET status='LIVE', distribution_status='PUBLISHED', approved_by=auth.uid(), approved_at=now()
        WHERE id = v_row.target_id;
      UPDATE schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;
  ELSIF _decision = 'rejected' THEN
    IF v_row.type = 'session' THEN
      UPDATE schedules SET status='DRAFT' WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE semester_registry SET status='DRAFT', distribution_status='DRAFT' WHERE id = v_row.target_id;
      UPDATE schedules SET status='DRAFT' WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;
  END IF;
END $function$;

-- ma_reject_semester_with_feedback -> FEEDBACK_ACTIVE
CREATE OR REPLACE FUNCTION public.ma_reject_semester_with_feedback(_semester_id uuid, _message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_thread uuid;
  v_dept uuid;
  v_dh uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN
    RAISE EXCEPTION 'Feedback message required';
  END IF;

  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  SELECT user_id INTO v_dh FROM public.department_heads WHERE department_id = v_dept LIMIT 1;

  INSERT INTO public.schedule_feedback_threads(semester_id, department_id, admin_id, dh_id)
  VALUES (_semester_id, v_dept, auth.uid(), v_dh)
  ON CONFLICT (semester_id) DO UPDATE SET admin_id = EXCLUDED.admin_id, dh_id = COALESCE(public.schedule_feedback_threads.dh_id, EXCLUDED.dh_id)
  RETURNING id INTO v_thread;

  INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
  VALUES (v_thread, auth.uid(), _message);

  UPDATE public.semester_registry SET status = 'DRAFT', distribution_status = 'FEEDBACK_ACTIVE' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'DRAFT' WHERE semester_id = _semester_id AND status = 'PENDING_MA';

  IF v_dh IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_dh, 'Schedule rejected', 'Admin returned the semester for changes. Open the chat to review.');
  END IF;

  RETURN v_thread;
END;
$function$;

-- dh_resubmit_semester -> PENDING_MA
CREATE OR REPLACE FUNCTION public.dh_resubmit_semester(_semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  UPDATE public.semester_registry SET status = 'PENDING_MA', distribution_status = 'PENDING_MA' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'PENDING_MA' WHERE semester_id = _semester_id AND status = 'DRAFT';

  INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
  SELECT 'semester'::approval_type, _semester_id, NULL, auth.uid(), 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_queue WHERE target_id = _semester_id AND decision = 'pending'
  );
END;
$function$;