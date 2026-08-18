-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.ct_industrial_department_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.departments
   WHERE name ILIKE '%INDUSTRIAL%'
   ORDER BY created_at
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.ct_is_ips()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'IPS'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.ct_is_program_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'PD'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.ct_is_industrial_dh()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'DH'::app_role)
     AND public.current_department_id() IS NOT NULL
     AND public.current_department_id() = public.ct_industrial_department_id();
$$;

CREATE OR REPLACE FUNCTION public.ct_pd_has_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ct_request_delegations d
                  WHERE d.request_id = _request_id AND d.delegated_to = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.ct_actor_role_label()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(string_agg(ur.role::text, '/' ORDER BY ur.role::text), 'UNKNOWN')
    FROM public.user_roles ur WHERE ur.user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.ct_industrial_department_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_is_ips() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_is_program_director() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_is_industrial_dh() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_pd_has_request(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_actor_role_label() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ct_industrial_department_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_is_ips() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_is_program_director() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_is_industrial_dh() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_pd_has_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_actor_role_label() TO authenticated;

-- ============ columns ============
ALTER TABLE public.ct_training_request_students
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text;

ALTER TABLE public.ct_training_requests
  ADD COLUMN IF NOT EXISTS manual_initiation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initiation_note text,
  ADD COLUMN IF NOT EXISTS ips_actor_id uuid,
  ADD COLUMN IF NOT EXISTS pd_actor_id uuid,
  ADD COLUMN IF NOT EXISTS decision_note text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

-- ============ decision audit table ============
CREATE TABLE IF NOT EXISTS public.ct_request_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ct_training_requests(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text,
  department_id uuid,
  action text NOT NULL,
  previous_status public.ct_request_status,
  new_status public.ct_request_status,
  comment text,
  delegated_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ct_request_decisions TO authenticated;
GRANT ALL ON public.ct_request_decisions TO service_role;
ALTER TABLE public.ct_request_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ct_decisions_read ON public.ct_request_decisions;
CREATE POLICY ct_decisions_read ON public.ct_request_decisions FOR SELECT TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_program_director() AND public.ct_pd_has_request(request_id))
  OR EXISTS (SELECT 1 FROM public.ct_training_requests r
              WHERE r.id = request_id
                AND public.has_role(auth.uid(),'DH'::app_role)
                AND r.department_id = public.current_department_id())
);
CREATE INDEX IF NOT EXISTS ct_request_decisions_request_idx ON public.ct_request_decisions(request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ct_record_decision(
  _request_id uuid, _action text, _prev public.ct_request_status,
  _new public.ct_request_status, _comment text, _delegated_to uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dept uuid;
BEGIN
  SELECT department_id INTO v_dept FROM public.ct_training_requests WHERE id = _request_id;
  INSERT INTO public.ct_request_decisions(request_id, actor_id, actor_role, department_id, action,
     previous_status, new_status, comment, delegated_to)
  VALUES (_request_id, auth.uid(), public.ct_actor_role_label(), v_dept, _action, _prev, _new, _comment, _delegated_to);
  PERFORM public.ct_log_event('ct_training_requests', _request_id, 'CT_' || _action,
    jsonb_build_object('previous_status', _prev, 'new_status', _new, 'comment', _comment, 'delegated_to', _delegated_to));
END $$;
REVOKE EXECUTE ON FUNCTION public.ct_record_decision(uuid, text, public.ct_request_status, public.ct_request_status, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ct_record_decision(uuid, text, public.ct_request_status, public.ct_request_status, text, uuid) TO authenticated;

-- ============ request creation: theory is a warning, not a block ============
CREATE OR REPLACE FUNCTION public.ct_create_request(_payload jsonb, _student_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_dept uuid; v_threshold numeric; s uuid; v_ref text;
        v_pct numeric; v_all int; v_present int; v_manual boolean := false; v_ind uuid;
BEGIN
  v_ind := public.ct_industrial_department_id();
  IF NOT (public.ct_is_admin() OR public.ct_is_ips() OR public.ct_is_industrial_dh()) THEN
    RAISE EXCEPTION 'Only the Industrial Department Head, the Industrial Practical Supervisor or an administrator can initiate a practical training request.';
  END IF;
  v_dept := (_payload->>'department_id')::uuid;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'Select a department.'; END IF;
  IF public.ct_is_industrial_dh() AND NOT public.ct_is_admin() AND NOT public.ct_is_ips()
     AND v_dept <> public.current_department_id() THEN
    RAISE EXCEPTION 'You can only create requests for your own department.';
  END IF;
  IF _student_ids IS NULL OR array_length(_student_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Add at least one trainee to the request.';
  END IF;
  SELECT COALESCE(theory_threshold_percent, 80) INTO v_threshold FROM public.ct_settings LIMIT 1;
  v_threshold := COALESCE(v_threshold, 80);

  v_ref := 'CT-' || to_char(now(),'YY') || '-' || lpad((
     (SELECT COUNT(*) + 1 FROM public.ct_training_requests
       WHERE created_at >= date_trunc('year', now())))::text, 4, '0');

  INSERT INTO public.ct_training_requests(reference, department_id, occupation_id, training_module_id,
     level_id, section_id, title, notes, requested_start_date, requested_end_date, created_by)
  VALUES (v_ref, v_dept, (_payload->>'occupation_id')::uuid,
     NULLIF(_payload->>'training_module_id','')::uuid,
     NULLIF(_payload->>'level_id','')::uuid, NULLIF(_payload->>'section_id','')::uuid,
     COALESCE(NULLIF(_payload->>'title',''),'Practical training request'),
     _payload->>'notes',
     (_payload->>'requested_start_date')::date, (_payload->>'requested_end_date')::date, auth.uid())
  RETURNING id INTO v_id;

  FOREACH s IN ARRAY _student_ids LOOP
    SELECT COUNT(*), COUNT(*) FILTER (WHERE present) INTO v_all, v_present
      FROM public.attendance_logs WHERE student_id = s;
    v_pct := CASE WHEN v_all > 0 THEN round((v_present::numeric / v_all) * 100) ELSE NULL END;
    INSERT INTO public.ct_training_request_students(request_id, student_id, theory_percent, eligible,
       manual_override, override_reason)
    VALUES (v_id, s, v_pct, (v_pct IS NOT NULL AND v_pct >= v_threshold),
       NOT (v_pct IS NOT NULL AND v_pct >= v_threshold),
       CASE WHEN (v_pct IS NOT NULL AND v_pct >= v_threshold) THEN NULL
            ELSE 'MANUALLY INITIATED — THEORY < ' || v_threshold::text || '%' END);
    IF NOT (v_pct IS NOT NULL AND v_pct >= v_threshold) THEN v_manual := true; END IF;
  END LOOP;

  IF v_manual THEN
    UPDATE public.ct_training_requests
       SET manual_initiation = true,
           initiation_note = 'MANUALLY INITIATED — THEORY < ' || v_threshold::text || '%'
     WHERE id = v_id;
  END IF;

  PERFORM public.ct_record_decision(v_id, 'CREATE_REQUEST', NULL, 'DRAFT'::public.ct_request_status,
    CASE WHEN v_manual THEN 'MANUALLY INITIATED — THEORY < ' || v_threshold::text || '%' ELSE NULL END, NULL);
  RETURN v_id;
END $$;

-- ============ submit ============
CREATE OR REPLACE FUNCTION public.ct_submit_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status; v_dept uuid;
BEGIN
  SELECT status, department_id INTO v_status, v_dept FROM public.ct_training_requests WHERE id = _request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF NOT (public.ct_is_admin() OR public.ct_is_ips()
          OR (public.ct_is_industrial_dh() AND v_dept = public.current_department_id())) THEN
    RAISE EXCEPTION 'You do not have permission to submit this request.';
  END IF;
  IF v_status NOT IN ('DRAFT','RETURNED_FOR_CORRECTION') THEN
    RAISE EXCEPTION 'Only draft or returned requests can be submitted (current: %).', v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ct_training_request_students WHERE request_id = _request_id) THEN
    RAISE EXCEPTION 'Add at least one trainee before submitting.';
  END IF;
  UPDATE public.ct_training_requests
     SET status='PENDING_APPROVAL', submitted_by=auth.uid(), submitted_at=now() WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'New practical training request', 'A practical training request needs your review.'
    FROM public.user_roles ur WHERE ur.role IN ('MA','IPS');
  PERFORM public.ct_record_decision(_request_id, 'SUBMIT_REQUEST', v_status, 'PENDING_APPROVAL'::public.ct_request_status, NULL, NULL);
END $$;

-- ============ IPS review / decision ============
CREATE OR REPLACE FUNCTION public.ct_ips_start_review(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can review requests.';
  END IF;
  SELECT status INTO v_status FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_status <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'This request is not awaiting supervisor review (current: %).', v_status;
  END IF;
  UPDATE public.ct_training_requests SET status='UNDER_IPS_REVIEW', ips_actor_id=auth.uid() WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'IPS_START_REVIEW', v_status, 'UNDER_IPS_REVIEW'::public.ct_request_status, NULL, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.ct_ips_decide_request(_request_id uuid, _decision text, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status; v_new public.ct_request_status; v_dept uuid;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can decide on practical training requests.';
  END IF;
  SELECT status, department_id INTO v_status, v_dept FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_status NOT IN ('PENDING_APPROVAL','UNDER_IPS_REVIEW','PD_APPROVED','IPS_FINAL_APPROVAL') THEN
    RAISE EXCEPTION 'This request cannot be decided in its current state (%).', v_status;
  END IF;
  v_new := CASE upper(_decision)
             WHEN 'APPROVE' THEN 'APPROVED'
             WHEN 'REJECT' THEN 'REJECTED'
             WHEN 'RETURN' THEN 'RETURNED_FOR_CORRECTION'
             ELSE NULL END::public.ct_request_status;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Unknown decision. Use APPROVE, REJECT or RETURN.'; END IF;
  IF upper(_decision) <> 'APPROVE' AND COALESCE(btrim(_comment),'') = '' THEN
    RAISE EXCEPTION 'Add a comment explaining the decision.';
  END IF;

  UPDATE public.ct_training_requests
     SET status=v_new, ips_actor_id=auth.uid(), decision_note=_comment, decided_at=now()
   WHERE id=_request_id;

  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT DISTINCT dh.user_id, 'Practical training request ' || v_new::text,
         COALESCE(NULLIF(_comment,''), 'The supervisor recorded a decision on your request.')
    FROM public.department_heads dh WHERE dh.department_id = v_dept;

  PERFORM public.ct_record_decision(_request_id, 'IPS_' || upper(_decision), v_status, v_new, _comment, NULL);
  RETURN jsonb_build_object('status', v_new);
END $$;

CREATE OR REPLACE FUNCTION public.ct_ips_delegate_request(_request_id uuid, _to_user uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can delegate requests.';
  END IF;
  IF NOT public.has_role(_to_user, 'PD'::app_role) THEN
    RAISE EXCEPTION 'Requests can only be delegated to a Program Director.';
  END IF;
  SELECT status INTO v_status FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_status NOT IN ('PENDING_APPROVAL','UNDER_IPS_REVIEW') THEN
    RAISE EXCEPTION 'Only requests under supervisor review can be delegated (current: %).', v_status;
  END IF;
  INSERT INTO public.ct_request_delegations(request_id, delegated_by, delegated_to, note)
  VALUES (_request_id, auth.uid(), _to_user, _note);
  UPDATE public.ct_training_requests SET status='DELEGATED_TO_PD', pd_actor_id=_to_user WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  VALUES (_to_user, 'Practical training request delegated to you',
          COALESCE(NULLIF(_note,''),'Please review this practical training request.'));
  PERFORM public.ct_record_decision(_request_id, 'IPS_DELEGATE', v_status, 'DELEGATED_TO_PD'::public.ct_request_status, _note, _to_user);
END $$;

-- ============ Program Director ============
CREATE OR REPLACE FUNCTION public.ct_pd_start_review(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status;
BEGIN
  IF NOT (public.ct_is_program_director() AND public.ct_pd_has_request(_request_id)) THEN
    RAISE EXCEPTION 'This request was not delegated to you.';
  END IF;
  SELECT status INTO v_status FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status <> 'DELEGATED_TO_PD' THEN
    RAISE EXCEPTION 'This request is not awaiting your review (current: %).', v_status;
  END IF;
  UPDATE public.ct_training_requests SET status='PD_REVIEW', pd_actor_id=auth.uid() WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'PD_START_REVIEW', v_status, 'PD_REVIEW'::public.ct_request_status, NULL, NULL);
END $$;

CREATE OR REPLACE FUNCTION public.ct_pd_decide_request(_request_id uuid, _decision text, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status; v_new public.ct_request_status;
BEGIN
  IF NOT (public.ct_is_program_director() AND public.ct_pd_has_request(_request_id)) THEN
    RAISE EXCEPTION 'This request was not delegated to you.';
  END IF;
  SELECT status INTO v_status FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_status NOT IN ('DELEGATED_TO_PD','PD_REVIEW') THEN
    RAISE EXCEPTION 'This request is not awaiting your decision (current: %).', v_status;
  END IF;
  v_new := CASE upper(_decision)
             WHEN 'APPROVE' THEN 'PD_APPROVED'
             WHEN 'REJECT' THEN 'REJECTED'
             WHEN 'RETURN' THEN 'RETURNED_FOR_CORRECTION'
             ELSE NULL END::public.ct_request_status;
  IF v_new IS NULL THEN RAISE EXCEPTION 'Unknown decision. Use APPROVE, REJECT or RETURN.'; END IF;
  IF upper(_decision) <> 'APPROVE' AND COALESCE(btrim(_comment),'') = '' THEN
    RAISE EXCEPTION 'Add a comment explaining the decision.';
  END IF;

  UPDATE public.ct_training_requests
     SET status=v_new, pd_actor_id=auth.uid(), decision_note=_comment WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'Program Director decision recorded',
         'A delegated practical training request now needs final supervisor processing.'
    FROM public.user_roles ur WHERE ur.role IN ('IPS','MA');
  PERFORM public.ct_record_decision(_request_id, 'PD_' || upper(_decision), v_status, v_new, _comment, NULL);
  RETURN jsonb_build_object('status', v_new);
END $$;

CREATE OR REPLACE FUNCTION public.ct_pd_bulk_return_to_ips(_request_ids uuid[], _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; v_status public.ct_request_status; v_done int := 0; v_skipped int := 0;
BEGIN
  IF NOT public.ct_is_program_director() THEN
    RAISE EXCEPTION 'Only a Program Director can perform this action.';
  END IF;
  IF _request_ids IS NULL OR array_length(_request_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one request.';
  END IF;
  FOREACH r IN ARRAY _request_ids LOOP
    IF NOT public.ct_pd_has_request(r) THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    SELECT status INTO v_status FROM public.ct_training_requests WHERE id=r FOR UPDATE;
    IF v_status NOT IN ('DELEGATED_TO_PD','PD_REVIEW') THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    UPDATE public.ct_training_requests
       SET status='PD_APPROVED', pd_actor_id=auth.uid(), decision_note=_note WHERE id=r;
    PERFORM public.ct_record_decision(r, 'PD_BULK_APPROVE', v_status, 'PD_APPROVED'::public.ct_request_status, _note, NULL);
    v_done := v_done + 1;
  END LOOP;
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'Program Director returned requests to the supervisor',
         v_done::text || ' request(s) are ready for final supervisor processing.'
    FROM public.user_roles ur WHERE ur.role IN ('IPS','MA');
  RETURN jsonb_build_object('processed', v_done, 'skipped', v_skipped);
END $$;

REVOKE EXECUTE ON FUNCTION public.ct_ips_start_review(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_ips_decide_request(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_ips_delegate_request(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_pd_start_review(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_pd_decide_request(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ct_pd_bulk_return_to_ips(uuid[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ct_ips_start_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_ips_decide_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_ips_delegate_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_pd_start_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_pd_decide_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ct_pd_bulk_return_to_ips(uuid[], text) TO authenticated;

-- ============ allocation accepts the new approved state ============
CREATE OR REPLACE FUNCTION public.ct_allocate_roster(_request_id uuid, _schedule jsonb, _allocations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_req public.ct_training_requests; v_sched uuid; a jsonb; v_count int := 0;
BEGIN
  SELECT * INTO v_req FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF NOT (public.ct_is_admin() OR public.ct_is_ips()
          OR (public.has_role(auth.uid(),'DH'::app_role) AND v_req.department_id = public.current_department_id())) THEN
    RAISE EXCEPTION 'You do not have permission to allocate this request.';
  END IF;
  IF v_req.status NOT IN ('APPROVED','ALLOCATED','SUBMITTED','DELEGATED') THEN
    RAISE EXCEPTION 'This request can no longer be allocated (status %).', v_req.status;
  END IF;
  IF _allocations IS NULL OR jsonb_array_length(_allocations) = 0 THEN
    RAISE EXCEPTION 'Assign at least one trainee to an enterprise.';
  END IF;

  INSERT INTO public.ct_training_schedules(request_id, start_date, end_date, days_per_week, daily_hours, created_by)
  VALUES (_request_id,
    COALESCE(NULLIF(_schedule->>'start_date','')::date, v_req.requested_start_date),
    COALESCE(NULLIF(_schedule->>'end_date','')::date, v_req.requested_end_date),
    COALESCE((_schedule->>'days_per_week')::int, 5),
    COALESCE((_schedule->>'daily_hours')::numeric, 8), auth.uid())
  RETURNING id INTO v_sched;

  DELETE FROM public.ct_student_placements WHERE request_id=_request_id AND NOT locked;

  FOR a IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
    INSERT INTO public.ct_student_placements(request_id, schedule_id, student_id, enterprise_id,
       training_site_id, mentor_contact_id, visiting_trainer_id, department_id, occupation_id,
       start_date, end_date, status, created_by)
    VALUES (_request_id, v_sched, (a->>'student_id')::uuid, (a->>'enterprise_id')::uuid,
       NULLIF(a->>'training_site_id','')::uuid, NULLIF(a->>'mentor_contact_id','')::uuid,
       NULLIF(a->>'visiting_trainer_id','')::uuid, v_req.department_id, v_req.occupation_id,
       COALESCE(NULLIF(_schedule->>'start_date','')::date, v_req.requested_start_date),
       COALESCE(NULLIF(_schedule->>'end_date','')::date, v_req.requested_end_date),
       'PENDING', auth.uid());
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.ct_training_requests SET status='ALLOCATED' WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'ALLOCATE_ROSTER', v_req.status, 'ALLOCATED'::public.ct_request_status, NULL, NULL);
  RETURN jsonb_build_object('schedule_id', v_sched, 'placements', v_count);
END $function$;

-- ============ RLS ============
DROP POLICY IF EXISTS ct_req_read ON public.ct_training_requests;
CREATE POLICY ct_req_read ON public.ct_training_requests FOR SELECT TO authenticated
USING (
  public.ct_is_admin()
  OR public.ct_is_ips()
  OR (public.ct_is_program_director() AND public.ct_pd_has_request(id))
  OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  OR (public.has_role(auth.uid(),'T'::app_role) AND EXISTS (
        SELECT 1 FROM public.ct_student_placements p
         WHERE p.request_id = ct_training_requests.id
           AND p.visiting_trainer_id = public.current_trainer_registry_id()))
  OR EXISTS (SELECT 1 FROM public.ct_training_request_students rs
              WHERE rs.request_id = ct_training_requests.id AND rs.student_id = public.ct_my_student_id())
);

DROP POLICY IF EXISTS ct_req_write ON public.ct_training_requests;
CREATE POLICY ct_req_write ON public.ct_training_requests FOR ALL TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_industrial_dh() AND department_id = public.current_department_id())
)
WITH CHECK (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_industrial_dh() AND department_id = public.current_department_id())
);

DROP POLICY IF EXISTS ct_reqstu_read ON public.ct_training_request_students;
CREATE POLICY ct_reqstu_read ON public.ct_training_request_students FOR SELECT TO authenticated
USING (
  student_id = public.ct_my_student_id()
  OR EXISTS (SELECT 1 FROM public.ct_training_requests r WHERE r.id = request_id)
);

DROP POLICY IF EXISTS ct_reqstu_write ON public.ct_training_request_students;
CREATE POLICY ct_reqstu_write ON public.ct_training_request_students FOR ALL TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR EXISTS (SELECT 1 FROM public.ct_training_requests r
              WHERE r.id = request_id AND public.ct_is_industrial_dh()
                AND r.department_id = public.current_department_id())
)
WITH CHECK (
  public.ct_is_admin() OR public.ct_is_ips()
  OR EXISTS (SELECT 1 FROM public.ct_training_requests r
              WHERE r.id = request_id AND public.ct_is_industrial_dh()
                AND r.department_id = public.current_department_id())
);

DROP POLICY IF EXISTS ct_deleg_read ON public.ct_request_delegations;
CREATE POLICY ct_deleg_read ON public.ct_request_delegations FOR SELECT TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR delegated_to = auth.uid() OR delegated_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.ct_training_requests r
              WHERE r.id = request_id AND public.has_role(auth.uid(),'DH'::app_role)
                AND r.department_id = public.current_department_id())
);

DROP POLICY IF EXISTS ct_deleg_write ON public.ct_request_delegations;
CREATE POLICY ct_deleg_write ON public.ct_request_delegations FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.ct_is_ips())
WITH CHECK (public.ct_is_admin() OR public.ct_is_ips());

DROP POLICY IF EXISTS ct_placement_read ON public.ct_student_placements;
CREATE POLICY ct_placement_read ON public.ct_student_placements FOR SELECT TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_program_director() AND public.ct_pd_has_request(request_id))
  OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  OR visiting_trainer_id = public.current_trainer_registry_id()
  OR enterprise_id IN (SELECT public.ct_mentor_enterprise_ids())
  OR student_id = public.ct_my_student_id()
);

DROP POLICY IF EXISTS ct_placement_write ON public.ct_student_placements;
CREATE POLICY ct_placement_write ON public.ct_student_placements FOR ALL TO authenticated
USING (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_industrial_dh() AND department_id = public.current_department_id())
)
WITH CHECK (
  public.ct_is_admin() OR public.ct_is_ips()
  OR (public.ct_is_industrial_dh() AND department_id = public.current_department_id())
);