ALTER TABLE public.ct_training_requests
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DROP FUNCTION IF EXISTS public.ct_ips_start_review(uuid);
DROP FUNCTION IF EXISTS public.ct_ips_decide_request(uuid, text, text);
DROP FUNCTION IF EXISTS public.ct_ips_delegate_request(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.ct_pd_start_review(uuid);
DROP FUNCTION IF EXISTS public.ct_pd_decide_request(uuid, text, text);
DROP FUNCTION IF EXISTS public.ct_pd_bulk_return_to_ips(uuid[], text);

CREATE OR REPLACE FUNCTION public.ct_assert_version(_current integer, _expected integer)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF _expected IS NOT NULL AND _expected <> _current THEN
    RAISE EXCEPTION 'This request was already updated by someone else — refresh to see the current status.'
      USING ERRCODE = '40001';
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.ct_ips_start_review(_request_id uuid, _expected_version integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can review requests.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
  IF v_status <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'This request is not awaiting supervisor review (current: %).', v_status;
  END IF;
  UPDATE public.ct_training_requests
     SET status='UNDER_IPS_REVIEW', ips_actor_id=auth.uid(), version=version+1
   WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'IPS_START_REVIEW', v_status, 'UNDER_IPS_REVIEW'::public.ct_request_status, NULL, NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.ct_ips_decide_request(_request_id uuid, _decision text, _comment text, _expected_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.ct_request_status; v_new public.ct_request_status; v_dept uuid; v_version integer;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can decide on practical training requests.';
  END IF;
  SELECT status, department_id, version INTO v_status, v_dept, v_version
    FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
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
     SET status=v_new, ips_actor_id=auth.uid(), decision_note=_comment, decided_at=now(), version=version+1
   WHERE id=_request_id;

  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT DISTINCT dh.user_id, 'Practical training request ' || v_new::text,
         COALESCE(NULLIF(_comment,''), 'The supervisor recorded a decision on your request.')
    FROM public.department_heads dh WHERE dh.department_id = v_dept;

  PERFORM public.ct_record_decision(_request_id, 'IPS_' || upper(_decision), v_status, v_new, _comment, NULL);
  RETURN jsonb_build_object('status', v_new);
END $function$;

CREATE OR REPLACE FUNCTION public.ct_ips_delegate_request(_request_id uuid, _to_user uuid, _note text, _expected_version integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can delegate requests.';
  END IF;
  IF NOT public.has_role(_to_user, 'PD'::app_role) THEN
    RAISE EXCEPTION 'Requests can only be delegated to a Program Director.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
  IF v_status NOT IN ('PENDING_APPROVAL','UNDER_IPS_REVIEW') THEN
    RAISE EXCEPTION 'Only requests under supervisor review can be delegated (current: %).', v_status;
  END IF;
  INSERT INTO public.ct_request_delegations(request_id, delegated_by, delegated_to, note)
  VALUES (_request_id, auth.uid(), _to_user, _note);
  UPDATE public.ct_training_requests
     SET status='DELEGATED_TO_PD', pd_actor_id=_to_user, version=version+1 WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  VALUES (_to_user, 'Practical training request delegated to you',
          COALESCE(NULLIF(_note,''),'Please review this practical training request.'));
  PERFORM public.ct_record_decision(_request_id, 'IPS_DELEGATE', v_status, 'DELEGATED_TO_PD'::public.ct_request_status, _note, _to_user);
END $function$;

CREATE OR REPLACE FUNCTION public.ct_pd_start_review(_request_id uuid, _expected_version integer DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_program_director() AND public.ct_pd_has_request(_request_id)) THEN
    RAISE EXCEPTION 'This request was not delegated to you.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
  IF v_status <> 'DELEGATED_TO_PD' THEN
    RAISE EXCEPTION 'This request is not awaiting your review (current: %).', v_status;
  END IF;
  UPDATE public.ct_training_requests
     SET status='PD_REVIEW', pd_actor_id=auth.uid(), version=version+1 WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'PD_START_REVIEW', v_status, 'PD_REVIEW'::public.ct_request_status, NULL, NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.ct_pd_decide_request(_request_id uuid, _decision text, _comment text, _expected_version integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status public.ct_request_status; v_new public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_program_director() AND public.ct_pd_has_request(_request_id)) THEN
    RAISE EXCEPTION 'This request was not delegated to you.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
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
     SET status=v_new, pd_actor_id=auth.uid(), decision_note=_comment, version=version+1 WHERE id=_request_id;
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'Program Director decision recorded',
         'A delegated practical training request now needs final supervisor processing.'
    FROM public.user_roles ur WHERE ur.role IN ('IPS','MA');
  PERFORM public.ct_record_decision(_request_id, 'PD_' || upper(_decision), v_status, v_new, _comment, NULL);
  RETURN jsonb_build_object('status', v_new);
END $function$;

CREATE OR REPLACE FUNCTION public.ct_pd_bulk_return_to_ips(_request_ids uuid[], _note text, _expected_versions jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r uuid; v_status public.ct_request_status; v_version integer; v_expected integer;
        v_done int := 0; v_skipped int := 0; v_results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.ct_is_program_director() THEN
    RAISE EXCEPTION 'Only a Program Director can perform this action.';
  END IF;
  IF _request_ids IS NULL OR array_length(_request_ids,1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one request.';
  END IF;
  IF COALESCE(btrim(_note),'') = '' THEN
    RAISE EXCEPTION 'Add a note explaining what the supervisor should look at.';
  END IF;
  FOREACH r IN ARRAY _request_ids LOOP
    IF NOT public.ct_pd_has_request(r) THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object('request_id', r, 'outcome', 'skipped', 'reason', 'not delegated to you');
      CONTINUE;
    END IF;
    SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=r FOR UPDATE;
    v_expected := NULLIF(_expected_versions -> r::text, 'null')::integer;
    IF v_expected IS NOT NULL AND v_expected <> v_version THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object('request_id', r, 'outcome', 'skipped', 'reason', 'changed by someone else');
      CONTINUE;
    END IF;
    IF v_status IS NULL OR v_status NOT IN ('DELEGATED_TO_PD','PD_REVIEW') THEN
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_object('request_id', r, 'outcome', 'skipped', 'reason', 'already processed');
      CONTINUE;
    END IF;
    UPDATE public.ct_training_requests
       SET status='PD_APPROVED', pd_actor_id=auth.uid(), decision_note=_note, version=version+1 WHERE id=r;
    PERFORM public.ct_record_decision(r, 'PD_BULK_APPROVE', v_status, 'PD_APPROVED'::public.ct_request_status, _note, NULL);
    v_done := v_done + 1;
    v_results := v_results || jsonb_build_object('request_id', r, 'outcome', 'applied');
  END LOOP;
  IF v_done > 0 THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT ur.user_id, 'Program Director returned requests to the supervisor',
           v_done::text || ' request(s) are ready for final supervisor processing.'
      FROM public.user_roles ur WHERE ur.role IN ('IPS','MA');
  END IF;
  RETURN jsonb_build_object('processed', v_done, 'skipped', v_skipped, 'results', v_results);
END $function$;