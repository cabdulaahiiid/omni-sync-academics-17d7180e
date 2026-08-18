CREATE POLICY "ct_evidence_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ct-evidence' AND owner = auth.uid());
CREATE POLICY "ct_evidence_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ct-evidence' AND (owner = auth.uid() OR public.ct_is_staff()));
CREATE POLICY "ct_evidence_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ct-evidence' AND (owner = auth.uid() OR public.ct_is_admin()));

-- Event helper
CREATE OR REPLACE FUNCTION public.ct_log_event(_entity_type text, _entity_id uuid, _event text, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ct_workflow_events(entity_type, entity_id, event_type, actor_id, payload)
  VALUES (_entity_type, _entity_id, _event, auth.uid(), _payload);
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), _event, _entity_type, _entity_id::text, _payload);
END $$;
REVOKE EXECUTE ON FUNCTION public.ct_log_event(text,uuid,text,jsonb) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ct_require_any(_roles app_role[]) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY(_roles)) THEN
    RAISE EXCEPTION 'You do not have permission to do this. Required role: %', array_to_string(_roles::text[], ' or ');
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.ct_require_any(app_role[]) FROM anon;

-- ===== Requests =====
CREATE OR REPLACE FUNCTION public.ct_create_request(_payload jsonb, _student_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_dept uuid; v_threshold numeric; s uuid; v_ref text;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','PD','CO']::app_role[]);
  v_dept := (_payload->>'department_id')::uuid;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'Select a department.'; END IF;
  IF public.has_role(auth.uid(),'DH'::app_role) AND NOT public.ct_is_admin()
     AND v_dept <> public.current_department_id() THEN
    RAISE EXCEPTION 'You can only create requests for your own department.';
  END IF;
  IF _student_ids IS NULL OR array_length(_student_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Add at least one trainee to the request.';
  END IF;
  SELECT theory_threshold_percent INTO v_threshold FROM public.ct_settings LIMIT 1;
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
    INSERT INTO public.ct_training_request_students(request_id, student_id, theory_percent, eligible)
    VALUES (v_id, s, NULL, true);
  END LOOP;

  PERFORM public.ct_log_event('ct_training_requests', v_id, 'CT_CREATE_REQUEST',
    jsonb_build_object('reference', v_ref, 'students', array_length(_student_ids,1), 'threshold', v_threshold));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ct_submit_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status ct_request_status;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','PD','CO']::app_role[]);
  SELECT status INTO v_status FROM public.ct_training_requests WHERE id = _request_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_status <> 'DRAFT' THEN RAISE EXCEPTION 'Only draft requests can be submitted (current: %).', v_status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ct_training_request_students WHERE request_id = _request_id) THEN
    RAISE EXCEPTION 'Add at least one trainee before submitting.';
  END IF;
  UPDATE public.ct_training_requests
     SET status='SUBMITTED', submitted_by=auth.uid(), submitted_at=now() WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'New practical training request', 'A practical training request needs your action.'
    FROM public.user_roles ur WHERE ur.role IN ('MA','PD');
  PERFORM public.ct_log_event('ct_training_requests', _request_id, 'CT_SUBMIT_REQUEST', '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.ct_delegate_request(_request_id uuid, _to_user uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','PD']::app_role[]);
  IF NOT EXISTS (SELECT 1 FROM public.ct_training_requests WHERE id=_request_id AND status IN ('SUBMITTED','DELEGATED')) THEN
    RAISE EXCEPTION 'Only submitted requests can be delegated.';
  END IF;
  INSERT INTO public.ct_request_delegations(request_id, delegated_by, delegated_to, note)
  VALUES (_request_id, auth.uid(), _to_user, _note);
  UPDATE public.ct_training_requests SET status='DELEGATED' WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  VALUES (_to_user, 'Training request delegated to you', COALESCE(NULLIF(_note,''),'Please allocate trainees to enterprises.'));
  PERFORM public.ct_log_event('ct_training_requests', _request_id, 'CT_DELEGATE_REQUEST',
    jsonb_build_object('delegated_to', _to_user, 'note', _note));
END $$;

-- ===== Allocation =====
CREATE OR REPLACE FUNCTION public.ct_allocate_roster(_request_id uuid, _schedule jsonb, _allocations jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.ct_training_requests; v_sched uuid; a jsonb; v_count int := 0;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','PD','CO','DH']::app_role[]);
  SELECT * INTO v_req FROM public.ct_training_requests WHERE id=_request_id;
  IF v_req.id IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  IF v_req.status NOT IN ('SUBMITTED','DELEGATED','ALLOCATED') THEN
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
  PERFORM public.ct_log_event('ct_training_requests', _request_id, 'CT_ALLOCATE_ROSTER',
    jsonb_build_object('schedule_id', v_sched, 'placements', v_count));
  RETURN jsonb_build_object('schedule_id', v_sched, 'placements', v_count);
END $$;

CREATE OR REPLACE FUNCTION public.ct_finalize_roster(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','PD','DH']::app_role[]);
  IF NOT EXISTS (SELECT 1 FROM public.ct_student_placements WHERE request_id=_request_id) THEN
    RAISE EXCEPTION 'Allocate trainees to enterprises before approving the roster.';
  END IF;
  UPDATE public.ct_student_placements SET status='CONFIRMED', locked=true
   WHERE request_id=_request_id AND status='PENDING';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.ct_training_schedules SET locked=true, locked_at=now(), locked_by=auth.uid()
   WHERE request_id=_request_id;
  UPDATE public.ct_training_requests SET status='SCHEDULED' WHERE id=_request_id;

  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT pr.id, 'Your practical placement is confirmed',
         'Open Cooperative Training to see your enterprise, dates and Day-1 check-in.'
    FROM public.ct_student_placements p
    JOIN public.profiles pr ON pr.student_id = p.student_id
   WHERE p.request_id=_request_id;

  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT DISTINCT c.user_id, 'New trainees assigned to your enterprise',
         'A confirmed roster of trainees has been assigned to you.'
    FROM public.ct_student_placements p
    JOIN public.ct_enterprise_contacts c ON c.enterprise_id = p.enterprise_id
   WHERE p.request_id=_request_id AND c.user_id IS NOT NULL;

  PERFORM public.ct_log_event('ct_training_requests', _request_id, 'CT_FINALIZE_ROSTER',
    jsonb_build_object('confirmed', v_count));
  RETURN jsonb_build_object('confirmed', v_count);
END $$;

-- ===== Day 1 check-in =====
CREATE OR REPLACE FUNCTION public.ct_checkin_day1(_placement_id uuid, _lat numeric, _lng numeric, _accuracy numeric, _device text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.ct_student_placements; v_lat numeric; v_lng numeric; v_rad numeric;
        v_dist numeric; v_ok boolean := true; v_geo_on boolean;
BEGIN
  SELECT * INTO v_p FROM public.ct_student_placements WHERE id=_placement_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Placement not found.'; END IF;
  IF NOT (public.ct_is_placement_trainee(_placement_id) OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned trainee can check in.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ct_day1_checkins WHERE placement_id=_placement_id) THEN
    RAISE EXCEPTION 'You have already completed your Day-1 check-in.';
  END IF;

  SELECT COALESCE(s.latitude, e.latitude), COALESCE(s.longitude, e.longitude),
         COALESCE(s.allowed_radius_meters, e.allowed_radius_meters, 200)
    INTO v_lat, v_lng, v_rad
    FROM public.ct_enterprises e
    LEFT JOIN public.ct_enterprise_training_sites s ON s.id = v_p.training_site_id
   WHERE e.id = v_p.enterprise_id;

  SELECT geofence_enabled INTO v_geo_on FROM public.global_config LIMIT 1;

  IF COALESCE(v_geo_on,true) AND v_lat IS NOT NULL AND _lat IS NOT NULL THEN
    v_dist := 6371000 * acos(LEAST(1, cos(radians(v_lat))*cos(radians(_lat))
              * cos(radians(_lng)-radians(v_lng)) + sin(radians(v_lat))*sin(radians(_lat))));
    v_ok := v_dist <= v_rad;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'You are % m from the training site (allowed % m). Move closer and try again.',
        round(v_dist), round(v_rad);
    END IF;
  END IF;

  INSERT INTO public.ct_day1_checkins(placement_id, latitude, longitude, accuracy_meters,
     distance_meters, geo_verified, device_info, created_by)
  VALUES (_placement_id, _lat, _lng, _accuracy, v_dist, v_ok, _device, auth.uid());

  UPDATE public.ct_student_placements SET status='ACTIVE' WHERE id=_placement_id AND status IN ('PENDING','CONFIRMED');
  UPDATE public.ct_training_requests SET status='ACTIVE'
   WHERE id = v_p.request_id AND status IN ('SCHEDULED','ALLOCATED');

  PERFORM public.ct_log_event('ct_student_placements', _placement_id, 'CT_DAY1_CHECKIN',
    jsonb_build_object('distance_m', v_dist, 'verified', v_ok));
  RETURN jsonb_build_object('ok', true, 'distance_m', v_dist);
END $$;

-- ===== Logbook =====
CREATE OR REPLACE FUNCTION public.ct_submit_logbook_day(_client_uuid uuid, _placement_id uuid, _entry_date date,
  _uc_id uuid, _task_id uuid, _task_description text, _hours numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing uuid; v_max numeric; v_total numeric; v_id uuid;
BEGIN
  IF NOT (public.ct_is_placement_trainee(_placement_id) OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the assigned trainee can write this logbook.';
  END IF;
  SELECT id INTO v_existing FROM public.ct_daily_logbook_entries WHERE client_uuid = _client_uuid;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_existing, 'replayed', true);
  END IF;
  IF _task_description IS NULL OR length(trim(_task_description)) = 0 THEN
    RAISE EXCEPTION 'Describe the task you performed.';
  END IF;
  IF _entry_date > CURRENT_DATE THEN RAISE EXCEPTION 'You cannot log a future date.'; END IF;

  SELECT max_daily_logbook_hours INTO v_max FROM public.ct_settings LIMIT 1;
  SELECT COALESCE(SUM(hours),0) INTO v_total FROM public.ct_daily_logbook_entries
   WHERE placement_id=_placement_id AND entry_date=_entry_date;
  IF v_total + _hours > COALESCE(v_max,12) THEN
    RAISE EXCEPTION 'Total hours for % would be % (limit % per day). Reduce the hours.',
      _entry_date, v_total + _hours, COALESCE(v_max,12);
  END IF;

  INSERT INTO public.ct_daily_logbook_entries(placement_id, entry_date, uc_id, task_id,
     task_description, hours, status, client_uuid, submitted_at, created_by)
  VALUES (_placement_id, _entry_date, _uc_id, _task_id, _task_description, _hours,
     'SUBMITTED', _client_uuid, now(), auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.ct_log_event('ct_daily_logbook_entries', v_id, 'CT_SUBMIT_LOGBOOK',
    jsonb_build_object('date', _entry_date, 'hours', _hours));
  RETURN jsonb_build_object('id', v_id, 'replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.ct_mentor_decide_logbook(_entry_id uuid, _decision ct_logbook_status, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_placement uuid; v_status ct_logbook_status;
BEGIN
  SELECT placement_id, status INTO v_placement, v_status FROM public.ct_daily_logbook_entries WHERE id=_entry_id;
  IF v_placement IS NULL THEN RAISE EXCEPTION 'Logbook entry not found.'; END IF;
  IF NOT (public.ct_is_placement_mentor(v_placement) OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the enterprise mentor can approve or reject this entry.';
  END IF;
  IF _decision NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'Choose approve or reject.'; END IF;
  IF v_status = 'APPROVED' THEN RAISE EXCEPTION 'This entry is already approved.'; END IF;
  IF _decision = 'REJECTED' AND (_comment IS NULL OR length(trim(_comment)) < 3) THEN
    RAISE EXCEPTION 'Add a short reason when rejecting an entry.';
  END IF;

  UPDATE public.ct_daily_logbook_entries SET status=_decision, updated_by=auth.uid() WHERE id=_entry_id;
  INSERT INTO public.ct_logbook_approvals(entry_id, decision, comment, decided_by)
  VALUES (_entry_id, _decision, _comment, auth.uid());
  PERFORM public.ct_log_event('ct_daily_logbook_entries', _entry_id, 'CT_LOGBOOK_'||_decision::text,
    jsonb_build_object('comment', _comment));
END $$;

-- ===== Supervision =====
CREATE OR REPLACE FUNCTION public.ct_record_supervision(_placement_id uuid, _visit_date date,
  _lat numeric, _lng numeric, _findings text, _actions text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_lat numeric; v_lng numeric; v_rad numeric; v_dist numeric;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','VT','T','CO']::app_role[]);
  IF NOT public.ct_can_view_placement(_placement_id) THEN
    RAISE EXCEPTION 'This placement is not assigned to you.';
  END IF;
  SELECT COALESCE(s.latitude, e.latitude), COALESCE(s.longitude, e.longitude),
         COALESCE(s.allowed_radius_meters, e.allowed_radius_meters, 200)
    INTO v_lat, v_lng, v_rad
    FROM public.ct_student_placements p
    JOIN public.ct_enterprises e ON e.id = p.enterprise_id
    LEFT JOIN public.ct_enterprise_training_sites s ON s.id = p.training_site_id
   WHERE p.id = _placement_id;
  IF v_lat IS NOT NULL AND _lat IS NOT NULL THEN
    v_dist := 6371000 * acos(LEAST(1, cos(radians(v_lat))*cos(radians(_lat))
              * cos(radians(_lng)-radians(v_lng)) + sin(radians(v_lat))*sin(radians(_lat))));
  END IF;
  INSERT INTO public.ct_supervision_visits(placement_id, visit_date, visited_by, latitude, longitude,
     distance_meters, geo_verified, findings, actions)
  VALUES (_placement_id, _visit_date, auth.uid(), _lat, _lng, v_dist,
     COALESCE(v_dist <= v_rad, false), _findings, _actions)
  RETURNING id INTO v_id;
  PERFORM public.ct_log_event('ct_supervision_visits', v_id, 'CT_SUPERVISION_VISIT',
    jsonb_build_object('placement_id', _placement_id, 'date', _visit_date, 'distance_m', v_dist));
  RETURN v_id;
END $$;

-- ===== Absence detection =====
CREATE OR REPLACE FUNCTION public.ct_detect_absences(_placement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p public.ct_student_placements; v_threshold int; v_streak int := 0;
        v_start date; d date; v_created int := 0; v_phone text; v_name text; v_parent text;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','CO']::app_role[]);
  SELECT * INTO v_p FROM public.ct_student_placements WHERE id=_placement_id;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Placement not found.'; END IF;
  SELECT absence_days_threshold INTO v_threshold FROM public.ct_settings LIMIT 1;
  v_threshold := COALESCE(v_threshold, 3);
  SELECT full_name, parent_guardian_telephone, parent_guardian_name
    INTO v_name, v_phone, v_parent FROM public.students WHERE id = v_p.student_id;

  d := v_p.start_date;
  WHILE d <= LEAST(v_p.end_date, CURRENT_DATE - 1) LOOP
    IF EXTRACT(dow FROM d) = 0 THEN
      d := d + 1; CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.ct_daily_logbook_entries
                WHERE placement_id=_placement_id AND entry_date=d AND status <> 'REJECTED') THEN
      v_streak := 0; v_start := NULL;
    ELSE
      IF v_streak = 0 THEN v_start := d; END IF;
      v_streak := v_streak + 1;
      IF v_streak = v_threshold THEN
        INSERT INTO public.ct_absence_events(placement_id, from_date, to_date, consecutive_days, reason)
        VALUES (_placement_id, v_start, d, v_streak, 'No approved logbook entries')
        ON CONFLICT (placement_id, from_date, to_date) DO NOTHING;
        IF FOUND AND v_phone IS NOT NULL THEN
          INSERT INTO public.ct_sms_queue(placement_id, student_id, phone, recipient_name, message, reason)
          VALUES (_placement_id, v_p.student_id, v_phone, v_parent,
            'Dear ' || COALESCE(v_parent,'Parent/Guardian') || ', ' || v_name ||
            ' has been absent from industrial practical training for ' || v_streak ||
            ' consecutive days since ' || v_start || '. Please contact the college.',
            'ABSENCE');
          UPDATE public.ct_absence_events SET parent_notified = true
           WHERE placement_id=_placement_id AND from_date=v_start AND to_date=d;
        END IF;
        v_created := v_created + 1;
      END IF;
    END IF;
    d := d + 1;
  END LOOP;

  PERFORM public.ct_log_event('ct_student_placements', _placement_id, 'CT_DETECT_ABSENCES',
    jsonb_build_object('events', v_created));
  RETURN jsonb_build_object('events', v_created);
END $$;

-- ===== Evaluations =====
CREATE OR REPLACE FUNCTION public.ct_submit_evaluation(_placement_id uuid, _source ct_evaluator_source,
  _uc_results jsonb, _competencies jsonb, _comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_eval uuid; r jsonb; v_name text;
BEGIN
  IF _source = 'MENTOR' THEN
    IF NOT (public.ct_is_placement_mentor(_placement_id) OR public.ct_is_admin()) THEN
      RAISE EXCEPTION 'Only the enterprise mentor can submit the mentor evaluation.';
    END IF;
  ELSE
    PERFORM public.ct_require_any(ARRAY['MA','DH','VT','T']::app_role[]);
    IF NOT public.ct_can_view_placement(_placement_id) THEN
      RAISE EXCEPTION 'This placement is not assigned to you.';
    END IF;
  END IF;
  IF _uc_results IS NULL OR jsonb_array_length(_uc_results) = 0 THEN
    RAISE EXCEPTION 'Rate at least one unit of competence.';
  END IF;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.ct_final_evaluations(placement_id, source, evaluator_id, evaluator_name, overall_comment)
  VALUES (_placement_id, _source, auth.uid(), v_name, _comment)
  ON CONFLICT (placement_id, source) DO UPDATE
    SET overall_comment = EXCLUDED.overall_comment, evaluator_id = EXCLUDED.evaluator_id,
        evaluator_name = EXCLUDED.evaluator_name
  RETURNING id INTO v_eval;

  DELETE FROM public.ct_uc_evaluations WHERE evaluation_id = v_eval;
  FOR r IN SELECT * FROM jsonb_array_elements(_uc_results) LOOP
    INSERT INTO public.ct_uc_evaluations(evaluation_id, uc_id, result, comment)
    VALUES (v_eval, (r->>'uc_id')::uuid, (r->>'result')::ct_uc_result, r->>'comment');
  END LOOP;

  DELETE FROM public.ct_basic_competency_evaluations WHERE evaluation_id = v_eval;
  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_competencies,'[]'::jsonb)) LOOP
    INSERT INTO public.ct_basic_competency_evaluations(evaluation_id, competency, rating, comment)
    VALUES (v_eval, r->>'competency', (r->>'rating')::ct_competency_rating, r->>'comment');
  END LOOP;

  PERFORM public.ct_log_event('ct_final_evaluations', v_eval, 'CT_SUBMIT_EVALUATION',
    jsonb_build_object('source', _source, 'placement_id', _placement_id));
  RETURN v_eval;
END $$;

CREATE OR REPLACE FUNCTION public.ct_finalize_evaluation(_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e public.ct_final_evaluations; v_failed int; v_red int; v_total int;
        v_hours int; v_rec ct_recommendation; v_cfg public.ct_settings;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','VT','T','CO']::app_role[]);
  SELECT * INTO v_e FROM public.ct_final_evaluations WHERE id=_evaluation_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Evaluation not found.'; END IF;
  IF v_e.finalized THEN RAISE EXCEPTION 'This evaluation is already finalized.'; END IF;
  SELECT * INTO v_cfg FROM public.ct_settings LIMIT 1;

  SELECT COUNT(*) FILTER (WHERE result='NP'), COUNT(*) INTO v_failed, v_total
    FROM public.ct_uc_evaluations WHERE evaluation_id=_evaluation_id;
  SELECT COUNT(*) FILTER (WHERE rating='RED') INTO v_red
    FROM public.ct_basic_competency_evaluations WHERE evaluation_id=_evaluation_id;

  v_hours := v_failed * v_cfg.remedial_hours_per_failed_uc
           + v_red * v_cfg.remedial_hours_per_red_competency;

  IF v_failed = 0 AND v_red <= v_cfg.max_red_competencies_for_assessment THEN
    v_rec := 'READY_FOR_ASSESSMENT';
  ELSIF v_total > 0 AND v_failed::numeric / v_total >= 0.5 THEN
    v_rec := 'REPEAT_PLACEMENT';
  ELSE
    v_rec := 'REMEDIAL_REQUIRED';
  END IF;

  UPDATE public.ct_final_evaluations
     SET failed_uc_count=v_failed, red_competency_count=v_red, remedial_hours=v_hours,
         recommendation=v_rec, calculation_version=v_cfg.calculation_version,
         finalized=true, finalized_at=now()
   WHERE id=_evaluation_id;

  DELETE FROM public.ct_skill_gaps WHERE evaluation_id=_evaluation_id;
  INSERT INTO public.ct_skill_gaps(placement_id, evaluation_id, uc_id, gap_type, detail)
  SELECT v_e.placement_id, _evaluation_id, ue.uc_id, 'UC_NOT_COMPETENT', u.name
    FROM public.ct_uc_evaluations ue JOIN public.ct_units_of_competence u ON u.id=ue.uc_id
   WHERE ue.evaluation_id=_evaluation_id AND ue.result='NP';
  INSERT INTO public.ct_skill_gaps(placement_id, evaluation_id, competency, gap_type, detail)
  SELECT v_e.placement_id, _evaluation_id, bc.competency, 'BASIC_COMPETENCY_RED', bc.comment
    FROM public.ct_basic_competency_evaluations bc
   WHERE bc.evaluation_id=_evaluation_id AND bc.rating='RED';

  DELETE FROM public.ct_remedial_actions WHERE evaluation_id=_evaluation_id AND NOT completed;
  IF v_hours > 0 THEN
    INSERT INTO public.ct_remedial_actions(placement_id, evaluation_id, description, hours)
    VALUES (v_e.placement_id, _evaluation_id,
      'Remedial training for ' || v_failed || ' unit(s) not yet competent and ' || v_red || ' weak basic competency(ies).',
      v_hours);
  END IF;

  PERFORM public.ct_log_event('ct_final_evaluations', _evaluation_id, 'CT_FINALIZE_EVALUATION',
    jsonb_build_object('failed_uc', v_failed, 'red', v_red, 'hours', v_hours, 'recommendation', v_rec));
  RETURN jsonb_build_object('failed_uc_count', v_failed, 'red_competency_count', v_red,
    'remedial_hours', v_hours, 'recommendation', v_rec);
END $$;

CREATE OR REPLACE FUNCTION public.ct_push_to_assessment(_evaluation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_e public.ct_final_evaluations; v_p public.ct_student_placements; v_id uuid;
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','CO']::app_role[]);
  SELECT * INTO v_e FROM public.ct_final_evaluations WHERE id=_evaluation_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Evaluation not found.'; END IF;
  IF NOT v_e.finalized THEN RAISE EXCEPTION 'Finalize the evaluation first.'; END IF;
  IF v_e.recommendation <> 'READY_FOR_ASSESSMENT' THEN
    RAISE EXCEPTION 'This trainee is not ready for assessment (%). Complete the remedial actions first.', v_e.recommendation;
  END IF;
  SELECT * INTO v_p FROM public.ct_student_placements WHERE id=v_e.placement_id;

  INSERT INTO public.ct_assessment_queue(placement_id, evaluation_id, student_id, occupation_id, queued_by)
  VALUES (v_p.id, _evaluation_id, v_p.student_id, v_p.occupation_id, auth.uid())
  ON CONFLICT (evaluation_id) DO UPDATE SET status='QUEUED'
  RETURNING id INTO v_id;

  UPDATE public.ct_student_placements SET status='COMPLETED' WHERE id=v_p.id AND status='ACTIVE';
  PERFORM public.ct_log_event('ct_assessment_queue', v_id, 'CT_PUSH_TO_ASSESSMENT',
    jsonb_build_object('student_id', v_p.student_id));
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.ct_create_request(jsonb, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_submit_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_delegate_request(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_allocate_roster(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_finalize_roster(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_checkin_day1(uuid, numeric, numeric, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_submit_logbook_day(uuid, uuid, date, uuid, uuid, text, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_mentor_decide_logbook(uuid, ct_logbook_status, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_record_supervision(uuid, date, numeric, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_detect_absences(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_submit_evaluation(uuid, ct_evaluator_source, jsonb, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_finalize_evaluation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ct_push_to_assessment(uuid) FROM anon;