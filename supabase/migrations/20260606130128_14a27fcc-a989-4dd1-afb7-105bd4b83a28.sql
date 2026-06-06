
-- Allow per-week feedback threads alongside semester-level
ALTER TABLE public.schedule_feedback_threads ADD COLUMN IF NOT EXISTS week_num int NULL;
ALTER TABLE public.schedule_feedback_threads DROP CONSTRAINT IF EXISTS schedule_feedback_threads_semester_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS schedule_feedback_threads_sem_week_uidx
  ON public.schedule_feedback_threads (semester_id, COALESCE(week_num, -1));

-- ===== ma_decide_week =====
CREATE OR REPLACE FUNCTION public.ma_decide_week(
  _department_id uuid,
  _week_num int,
  _decision approval_decision,
  _message text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_aq RECORD;
  v_semester_id uuid;
  v_dh_user uuid;
  v_thread uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;

  IF _decision = 'rejected' AND (_message IS NULL OR length(trim(_message)) < 3) THEN
    RAISE EXCEPTION 'Feedback message required to send back';
  END IF;

  SELECT user_id INTO v_dh_user FROM public.department_heads WHERE department_id = _department_id LIMIT 1;

  FOR v_aq IN
    SELECT aq.id, aq.schedule_id, s.semester_id
      FROM public.approval_queue aq
      JOIN public.schedules s ON s.id = aq.schedule_id
     WHERE aq.type = 'session'
       AND aq.decision = 'pending'
       AND s.department_id = _department_id
       AND s.week_num = _week_num
  LOOP
    v_semester_id := v_aq.semester_id;
    IF _decision = 'approved' THEN
      UPDATE public.approval_queue
         SET decision='approved', decided_by=auth.uid(), decided_at=now(), comment=_message
       WHERE id = v_aq.id;
      UPDATE public.schedules
         SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
       WHERE id = v_aq.schedule_id AND status='PENDING_MA';
    ELSE
      UPDATE public.approval_queue
         SET decision='rejected', decided_by=auth.uid(), decided_at=now(),
             comment = COALESCE(comment,'') || CASE WHEN comment IS NULL OR comment='' THEN '' ELSE E'\n' END || _message
       WHERE id = v_aq.id;
      UPDATE public.schedules SET status='DRAFT' WHERE id = v_aq.schedule_id AND status='PENDING_MA';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('count', 0);
  END IF;

  IF _decision = 'approved' THEN
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, 'Week ' || _week_num || ' approved & published',
              COALESCE(NULLIF(_message,''), v_count || ' session(s) are now live.'));
    END IF;
    -- Notify each assigned trainer for this dept+week
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT DISTINCT p.id, 'New sessions published',
           'Week ' || _week_num || ' was just approved. Open the app to view your schedule.'
      FROM public.schedules s
      JOIN public.profiles p ON p.trainer_registry_id = s.trainer_registry_id
     WHERE s.department_id = _department_id
       AND s.week_num = _week_num
       AND s.is_published = true;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'APPROVE_WEEK', 'week', _department_id::text || ':' || _week_num::text,
            jsonb_build_object('department_id', _department_id, 'week_num', _week_num, 'count', v_count, 'comment', _message));
  ELSE
    -- Reject: open/append a per-week feedback thread on the (last seen) semester
    IF v_semester_id IS NOT NULL THEN
      INSERT INTO public.schedule_feedback_threads(semester_id, department_id, admin_id, dh_id, week_num)
      VALUES (v_semester_id, _department_id, auth.uid(), v_dh_user, _week_num)
      ON CONFLICT (semester_id, COALESCE(week_num,-1))
      DO UPDATE SET admin_id = EXCLUDED.admin_id,
                    dh_id = COALESCE(public.schedule_feedback_threads.dh_id, EXCLUDED.dh_id)
      RETURNING id INTO v_thread;

      INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
      VALUES (v_thread, auth.uid(), 'Week ' || _week_num || ' feedback: ' || _message);
    END IF;

    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, 'Week ' || _week_num || ' sent back for changes', _message);
    END IF;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'REJECT_WEEK_WITH_FEEDBACK', 'week', _department_id::text || ':' || _week_num::text,
            jsonb_build_object('department_id', _department_id, 'week_num', _week_num, 'count', v_count, 'message', _message));
  END IF;

  RETURN jsonb_build_object('count', v_count, 'thread_id', v_thread);
END
$$;

GRANT EXECUTE ON FUNCTION public.ma_decide_week(uuid, int, approval_decision, text) TO authenticated;

-- ===== dh_resubmit_week =====
CREATE OR REPLACE FUNCTION public.dh_resubmit_week(_semester_id uuid, _week_num int)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_dept uuid;
  v_count int := 0;
  v_sched RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  FOR v_sched IN
    SELECT id FROM public.schedules
     WHERE semester_id = _semester_id AND week_num = _week_num AND status = 'DRAFT'
  LOOP
    UPDATE public.schedules SET status='PENDING_MA' WHERE id = v_sched.id;
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_count := v_count + 1;
  END LOOP;

  -- Notify all MAs
  IF v_count > 0 THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT ur.user_id, 'Week ' || _week_num || ' resubmitted',
           'DH resubmitted ' || v_count || ' session(s) after addressing feedback.'
      FROM public.user_roles ur WHERE ur.role = 'MA'::app_role;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'RESUBMIT_WEEK', 'week', _semester_id::text || ':' || _week_num::text,
            jsonb_build_object('semester_id', _semester_id, 'week_num', _week_num, 'count', v_count));
  END IF;

  RETURN v_count;
END
$$;

GRANT EXECUTE ON FUNCTION public.dh_resubmit_week(uuid, int) TO authenticated;
