
-- submit_for_approval: notify all MAs when a new request lands
CREATE OR REPLACE FUNCTION public.submit_for_approval(_type approval_type, _target_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_id uuid;
  v_title text;
  v_body text;
  v_dept_name text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'MA'::app_role)) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;

  FOREACH v_id IN ARRAY _target_ids LOOP
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES (_type, v_id, CASE WHEN _type='session' THEN v_id ELSE NULL END, auth.uid(), 'pending');

    IF _type = 'session' THEN
      UPDATE public.schedules SET status='PENDING_MA' WHERE id = v_id AND status='DRAFT';
    ELSE
      UPDATE public.semester_registry SET status='PENDING_MA', distribution_status='PENDING_MA' WHERE id = v_id;
      UPDATE public.schedules SET status='PENDING_MA' WHERE semester_id = v_id AND status='DRAFT';
    END IF;

    -- Audit
    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'SUBMIT_FOR_APPROVAL', _type::text, v_id::text,
            jsonb_build_object('type', _type, 'target_id', v_id));

    v_count := v_count + 1;
  END LOOP;

  -- Notify every MA
  IF v_count > 0 THEN
    v_title := CASE WHEN _type='semester' THEN 'New semester approval request' ELSE 'New session approval request' END;
    v_body  := 'A Department Head submitted ' || v_count || ' ' || _type::text || '(s) for your review.';
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT ur.user_id, v_title, v_body
      FROM public.user_roles ur
     WHERE ur.role = 'MA'::app_role;
  END IF;

  RETURN v_count;
END
$function$;

-- decide_approval: notify DH + (for approvals) assigned trainers; audit log
CREATE OR REPLACE FUNCTION public.decide_approval(_id uuid, _decision approval_decision, _comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.approval_queue;
  v_dept_id uuid;
  v_dh_user uuid;
  v_title text;
  v_body text;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT * INTO v_row FROM public.approval_queue WHERE id = _id;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  UPDATE public.approval_queue
    SET decision = _decision, decided_by = auth.uid(), decided_at = now(), comment = _comment
    WHERE id = _id;

  -- Find the owning department for notifications
  IF v_row.type = 'session' THEN
    SELECT department_id INTO v_dept_id FROM public.schedules WHERE id = v_row.target_id;
  ELSE
    SELECT department_id INTO v_dept_id FROM public.schedules WHERE semester_id = v_row.target_id LIMIT 1;
  END IF;
  SELECT user_id INTO v_dh_user FROM public.department_heads WHERE department_id = v_dept_id LIMIT 1;

  IF _decision = 'approved' THEN
    IF v_row.type = 'session' THEN
      UPDATE public.schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE public.semester_registry SET status='LIVE', distribution_status='PUBLISHED', approved_by=auth.uid(), approved_at=now()
        WHERE id = v_row.target_id;
      UPDATE public.schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;

    v_title := CASE WHEN v_row.type='semester' THEN 'Semester approved & published' ELSE 'Session approved & published' END;
    v_body  := COALESCE(NULLIF(_comment,''), 'Schedule is now live for trainers.');

    -- Notify DH
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, v_title, v_body);
    END IF;

    -- Notify assigned trainers (whose profile.user_id maps via trainer_registry_id)
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT DISTINCT p.id, 'New schedule available', 'Your timetable was just published. Open the app to view today''s sessions.'
      FROM public.schedules s
      JOIN public.profiles p ON p.trainer_registry_id = s.trainer_registry_id
     WHERE (v_row.type='session' AND s.id = v_row.target_id)
        OR (v_row.type='semester' AND s.semester_id = v_row.target_id)
       AND s.is_published = true;

  ELSIF _decision = 'rejected' THEN
    IF v_row.type = 'session' THEN
      UPDATE public.schedules SET status='DRAFT' WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE public.semester_registry SET status='DRAFT', distribution_status='DRAFT' WHERE id = v_row.target_id;
      UPDATE public.schedules SET status='DRAFT' WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;

    v_title := CASE WHEN v_row.type='semester' THEN 'Semester sent back for changes' ELSE 'Session sent back for changes' END;
    v_body  := COALESCE(NULLIF(_comment,''), 'Admin returned the request. Please review feedback.');
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, v_title, v_body);
    END IF;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(),
          CASE WHEN _decision='approved' THEN 'APPROVE' ELSE 'REJECT' END,
          v_row.type::text,
          v_row.target_id::text,
          jsonb_build_object('decision', _decision, 'comment', _comment, 'approval_id', _id));
END
$function$;

-- dh_resubmit_semester: notify MAs + audit
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

  -- Notify all MAs
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'Semester resubmitted', 'A Department Head resubmitted a semester after addressing your feedback.'
    FROM public.user_roles ur
   WHERE ur.role = 'MA'::app_role;

  -- Audit
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'RESUBMIT', 'semester', _semester_id::text,
          jsonb_build_object('semester_id', _semester_id));
END
$function$;

-- ma_reject_semester_with_feedback: add audit log (notification already inserted)
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

  -- Close out any pending approval queue rows for this semester
  UPDATE public.approval_queue
     SET decision = 'rejected', decided_by = auth.uid(), decided_at = now(),
         comment = COALESCE(comment, '') || CASE WHEN comment IS NULL OR comment='' THEN '' ELSE E'\n' END || _message
   WHERE type='semester' AND target_id = _semester_id AND decision = 'pending';

  IF v_dh IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_dh, 'Schedule rejected', 'Admin returned the semester for changes. Open the chat to review.');
  END IF;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'REJECT_WITH_FEEDBACK', 'semester', _semester_id::text,
          jsonb_build_object('semester_id', _semester_id, 'message', _message));

  RETURN v_thread;
END
$function$;
