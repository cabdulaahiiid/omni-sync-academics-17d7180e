
CREATE OR REPLACE FUNCTION public.ma_split_semester_to_weeks(_approval_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semester_id uuid;
  v_type approval_type;
  v_decision approval_decision;
  v_created int := 0;
  v_sched record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;

  SELECT target_id, type, decision INTO v_semester_id, v_type, v_decision
    FROM public.approval_queue WHERE id = _approval_id;
  IF v_semester_id IS NULL THEN RAISE EXCEPTION 'Approval not found'; END IF;
  IF v_type <> 'semester' THEN RAISE EXCEPTION 'Not a semester approval'; END IF;
  IF v_decision <> 'pending' THEN RAISE EXCEPTION 'Approval already decided'; END IF;

  -- Create pending session-level approvals for every schedule in the semester
  -- that does not already have a pending row.
  FOR v_sched IN
    SELECT s.id
      FROM public.schedules s
     WHERE s.semester_id = v_semester_id
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_queue aq
          WHERE aq.type = 'session' AND aq.schedule_id = s.id AND aq.decision = 'pending'
       )
  LOOP
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_created := v_created + 1;
  END LOOP;

  UPDATE public.schedules
     SET status = 'PENDING_MA'
   WHERE semester_id = v_semester_id AND status = 'DRAFT';

  -- Resolve the semester-level approval
  UPDATE public.approval_queue
     SET decision = 'approved',
         decided_by = auth.uid(),
         decided_at = now(),
         comment = COALESCE(comment,'') || CASE WHEN COALESCE(comment,'')='' THEN '' ELSE E'\n' END || 'Split into weeks'
   WHERE id = _approval_id;

  UPDATE public.semester_registry
     SET distribution_status = 'PENDING_MA'
   WHERE id = v_semester_id;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'SPLIT_SEMESTER_TO_WEEKS', 'semester', v_semester_id::text,
          jsonb_build_object('approval_id', _approval_id, 'created_session_approvals', v_created));

  RETURN jsonb_build_object('semester_id', v_semester_id, 'created', v_created);
END
$$;

GRANT EXECUTE ON FUNCTION public.ma_split_semester_to_weeks(uuid) TO authenticated;
