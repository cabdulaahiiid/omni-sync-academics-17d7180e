CREATE OR REPLACE FUNCTION public.dh_submit_semester_per_week(_semester_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_dept uuid; v_created int := 0; v_sched record;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id=_semester_id LIMIT 1;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'No schedules for semester'; END IF;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  FOR v_sched IN
    SELECT s.id FROM public.schedules s
     WHERE s.semester_id=_semester_id
       AND s.status IN ('DRAFT','PENDING_MA')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_queue aq
          WHERE aq.type='session' AND aq.schedule_id=s.id AND aq.decision='pending'
       )
  LOOP
    INSERT INTO public.approval_queue(type,target_id,schedule_id,submitted_by,decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_created := v_created+1;
  END LOOP;

  UPDATE public.schedules SET status='PENDING_MA'
    WHERE semester_id=_semester_id AND status='DRAFT';

  UPDATE public.semester_registry SET status='PENDING_MA', distribution_status='PENDING_MA'
    WHERE id=_semester_id;

  -- Close any pending semester-level approval (DH switched to per-week)
  UPDATE public.approval_queue
     SET decision='approved', decided_by=auth.uid(), decided_at=now(),
         comment=COALESCE(comment,'')||CASE WHEN COALESCE(comment,'')='' THEN '' ELSE E'\n' END||'Switched to per-week submission'
   WHERE type='semester' AND target_id=_semester_id AND decision='pending';

  INSERT INTO public.notifications(recipient_id,title,body)
  SELECT ur.user_id,'Per-week approval submitted',
         'DH submitted '||v_created||' weekly session(s) for review.'
    FROM public.user_roles ur WHERE ur.role='MA'::app_role;

  INSERT INTO public.audit_logs(actor_id,action_type,entity_type,entity_id,after_state)
  VALUES (auth.uid(),'SUBMIT_PER_WEEK','semester',_semester_id::text,
          jsonb_build_object('semester_id',_semester_id,'created',v_created));

  RETURN jsonb_build_object('created', v_created);
END $$;

GRANT EXECUTE ON FUNCTION public.dh_submit_semester_per_week(uuid) TO authenticated;