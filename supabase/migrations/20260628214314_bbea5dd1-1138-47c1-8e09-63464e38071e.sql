
CREATE OR REPLACE FUNCTION public.ma_delete_schedule(_schedule_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sched public.schedules;
  v_trainer_user uuid;
  v_thread uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to delete a schedule';
  END IF;

  SELECT * INTO v_sched FROM public.schedules WHERE id = _schedule_id;
  IF v_sched IS NULL THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  SELECT p.id INTO v_trainer_user
    FROM public.profiles p
   WHERE p.trainer_registry_id = v_sched.trainer_registry_id
   LIMIT 1;

  -- Cleanup in FK-safe order
  DELETE FROM public.attendance_overrides ao
   USING public.attendance_logs al
   WHERE ao.attendance_log_id = al.id
     AND al.schedule_id = _schedule_id;

  DELETE FROM public.attendance_logs WHERE schedule_id = _schedule_id;
  DELETE FROM public.session_logs    WHERE schedule_id = _schedule_id;
  DELETE FROM public.pending_sync    WHERE schedule_id = _schedule_id;

  -- Week-scoped feedback threads tied to this schedule's week (semester-level threads kept)
  IF v_sched.semester_id IS NOT NULL AND v_sched.week_num IS NOT NULL THEN
    FOR v_thread IN
      SELECT id FROM public.schedule_feedback_threads
       WHERE semester_id = v_sched.semester_id AND week_num = v_sched.week_num
    LOOP
      DELETE FROM public.schedule_feedback_messages WHERE thread_id = v_thread;
      DELETE FROM public.schedule_feedback_threads  WHERE id = v_thread;
    END LOOP;
  END IF;

  DELETE FROM public.approval_queue
   WHERE (type = 'session' AND (schedule_id = _schedule_id OR target_id = _schedule_id));

  DELETE FROM public.schedules WHERE id = _schedule_id;

  IF v_trainer_user IS NOT NULL AND v_sched.is_published THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_trainer_user, 'Schedule removed by admin',
            COALESCE(v_sched.module_name, v_sched.module_code, 'Session') ||
            ' on ' || v_sched.date::text || ' has been removed. Reason: ' || _reason);
  END IF;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'MA_DELETE_SCHEDULE', 'schedules', _schedule_id::text,
          to_jsonb(v_sched),
          jsonb_build_object('reason', _reason));

  RETURN jsonb_build_object('ok', true, 'id', _schedule_id);
END
$function$;
