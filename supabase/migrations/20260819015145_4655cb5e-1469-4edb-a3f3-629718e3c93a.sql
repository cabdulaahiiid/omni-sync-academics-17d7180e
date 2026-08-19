-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE public.ct_task_confirm_status AS ENUM ('DRAFT','SUBMITTED','ENTERPRISE_APPROVED','RETURNED','LOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ tables ============
CREATE TABLE IF NOT EXISTS public.ct_practical_task_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  plan_task_id uuid REFERENCES public.schedule_plan_practical_tasks(id) ON DELETE SET NULL,
  task_title text NOT NULL,
  competency_code text,
  task_date date NOT NULL,
  attendance public.ct_attendance_status NOT NULL DEFAULT 'PRESENT',
  hours numeric(5,2) NOT NULL DEFAULT 0,
  performance_rating integer NOT NULL DEFAULT 3,
  safety_breach boolean NOT NULL DEFAULT false,
  remarks text,
  status public.ct_task_confirm_status NOT NULL DEFAULT 'DRAFT',
  version integer NOT NULL DEFAULT 1,
  submitted_by uuid,
  submitted_at timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  decision_comment text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ct_ptc_rating_range CHECK (performance_rating BETWEEN 1 AND 5),
  CONSTRAINT ct_ptc_hours_range CHECK (hours >= 0 AND hours <= 24)
);

CREATE UNIQUE INDEX IF NOT EXISTS ct_ptc_unique_task_day
  ON public.ct_practical_task_confirmations (placement_id, task_date, lower(task_title), coalesce(plan_task_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS ct_ptc_placement_idx ON public.ct_practical_task_confirmations (placement_id, task_date DESC);
CREATE INDEX IF NOT EXISTS ct_ptc_status_idx ON public.ct_practical_task_confirmations (status);

CREATE TABLE IF NOT EXISTS public.ct_practical_task_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_id uuid NOT NULL REFERENCES public.ct_practical_task_confirmations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  reason text NOT NULL,
  corrected_by uuid,
  corrected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ct_ptcorr_conf_idx ON public.ct_practical_task_corrections (confirmation_id, corrected_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.ct_practical_task_confirmations TO authenticated;
GRANT ALL ON public.ct_practical_task_confirmations TO service_role;
GRANT SELECT ON public.ct_practical_task_corrections TO authenticated;
GRANT ALL ON public.ct_practical_task_corrections TO service_role;

ALTER TABLE public.ct_practical_task_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ct_practical_task_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY ct_ptc_read ON public.ct_practical_task_confirmations
  FOR SELECT TO authenticated
  USING (public.ct_can_view_placement(placement_id));

CREATE POLICY ct_ptc_write ON public.ct_practical_task_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (public.ct_is_placement_mentor(placement_id) OR public.ct_can_access_department(department_id));

CREATE POLICY ct_ptc_update ON public.ct_practical_task_confirmations
  FOR UPDATE TO authenticated
  USING (public.ct_is_placement_mentor(placement_id) OR public.ct_can_access_department(department_id))
  WITH CHECK (public.ct_is_placement_mentor(placement_id) OR public.ct_can_access_department(department_id));

CREATE POLICY ct_ptcorr_read ON public.ct_practical_task_corrections
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ct_practical_task_confirmations c
    WHERE c.id = confirmation_id AND public.ct_can_view_placement(c.placement_id)
  ));

CREATE TRIGGER ct_ptc_set_updated_at
  BEFORE UPDATE ON public.ct_practical_task_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

-- ============ trainer placement gate ============
CREATE OR REPLACE FUNCTION public.ct_is_trainer_on_active_placement(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ct_student_placements p
    JOIN public.profiles pr ON pr.trainer_registry_id = p.visiting_trainer_id
    WHERE pr.id = _user_id
      AND p.status IN ('CONFIRMED','ACTIVE')
  );
$$;

-- ============ confirm / decide / correct ============
CREATE OR REPLACE FUNCTION public.ct_confirm_practical_task(
  _placement_id uuid,
  _plan_task_id uuid,
  _task_title text,
  _competency_code text,
  _task_date date,
  _attendance public.ct_attendance_status,
  _hours numeric,
  _performance_rating integer,
  _safety_breach boolean,
  _remarks text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  max_hours numeric;
  used_hours numeric;
  new_id uuid;
BEGIN
  SELECT * INTO p FROM public.ct_student_placements WHERE id = _placement_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'This placement no longer exists.';
  END IF;
  IF NOT (public.ct_is_placement_mentor(_placement_id) OR public.ct_can_access_department(p.department_id)) THEN
    RAISE EXCEPTION 'You are not allowed to record work for this trainee.';
  END IF;
  IF p.locked THEN
    RAISE EXCEPTION 'This placement is locked, so new task confirmations cannot be added.';
  END IF;
  IF _task_date < p.start_date OR (p.end_date IS NOT NULL AND _task_date > p.end_date) THEN
    RAISE EXCEPTION 'The date % is outside the placement period (% to %).', _task_date, p.start_date, coalesce(p.end_date::text, 'open');
  END IF;

  SELECT coalesce(max_daily_logbook_hours, 12) INTO max_hours FROM public.ct_settings LIMIT 1;
  max_hours := coalesce(max_hours, 12);

  SELECT coalesce(sum(hours), 0) INTO used_hours
  FROM public.ct_practical_task_confirmations
  WHERE placement_id = _placement_id AND task_date = _task_date;

  IF used_hours + coalesce(_hours, 0) > max_hours THEN
    RAISE EXCEPTION 'Daily limit reached: % hour(s) already recorded on %, and the maximum is % hour(s).', used_hours, _task_date, max_hours;
  END IF;

  INSERT INTO public.ct_practical_task_confirmations (
    placement_id, department_id, plan_task_id, task_title, competency_code, task_date,
    attendance, hours, performance_rating, safety_breach, remarks,
    status, submitted_by, submitted_at, created_by, updated_by
  ) VALUES (
    _placement_id, p.department_id, _plan_task_id, _task_title, nullif(_competency_code, ''), _task_date,
    coalesce(_attendance, 'PRESENT'), coalesce(_hours, 0), coalesce(_performance_rating, 3),
    coalesce(_safety_breach, false), nullif(_remarks, ''),
    'SUBMITTED', auth.uid(), now(), auth.uid(), auth.uid()
  )
  RETURNING id INTO new_id;

  PERFORM public.ct_log_event('practical_task_confirmation', new_id, 'SUBMITTED', jsonb_build_object('placement_id', _placement_id, 'task', _task_title, 'date', _task_date));
  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This task is already recorded for this trainee on %. Open the existing record and correct it instead.', _task_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.ct_decide_practical_task(
  _confirmation_id uuid,
  _decision text,
  _comment text,
  _expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  next_status public.ct_task_confirm_status;
BEGIN
  SELECT * INTO c FROM public.ct_practical_task_confirmations WHERE id = _confirmation_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'This record no longer exists.';
  END IF;
  IF NOT (public.ct_is_placement_mentor(c.placement_id) OR public.ct_can_access_department(c.department_id)) THEN
    RAISE EXCEPTION 'You are not allowed to review this record.';
  END IF;
  IF _expected_version IS NOT NULL AND _expected_version <> c.version THEN
    RAISE EXCEPTION 'This record changed while you were reviewing it. Refresh and try again.';
  END IF;
  IF c.status = 'LOCKED' THEN
    RAISE EXCEPTION 'This record is locked. Use a correction to change it.';
  END IF;
  IF c.status = 'ENTERPRISE_APPROVED' AND _decision <> 'LOCK' THEN
    RAISE EXCEPTION 'This record is already approved. Use a correction to change it.';
  END IF;

  next_status := CASE _decision
    WHEN 'APPROVE' THEN 'ENTERPRISE_APPROVED'::public.ct_task_confirm_status
    WHEN 'RETURN' THEN 'RETURNED'::public.ct_task_confirm_status
    WHEN 'LOCK' THEN 'LOCKED'::public.ct_task_confirm_status
    ELSE NULL END;
  IF next_status IS NULL THEN
    RAISE EXCEPTION 'Unknown decision "%".', _decision;
  END IF;
  IF next_status = 'RETURNED' AND coalesce(btrim(_comment), '') = '' THEN
    RAISE EXCEPTION 'Explain what the trainee must fix before returning this record.';
  END IF;

  UPDATE public.ct_practical_task_confirmations
     SET status = next_status,
         decision_comment = nullif(_comment, ''),
         decided_by = auth.uid(),
         decided_at = now(),
         version = version + 1,
         updated_by = auth.uid()
   WHERE id = _confirmation_id;

  PERFORM public.ct_log_event('practical_task_confirmation', _confirmation_id, _decision, jsonb_build_object('comment', _comment));
  RETURN jsonb_build_object('ok', true, 'status', next_status, 'version', c.version + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.ct_correct_practical_task(
  _confirmation_id uuid,
  _attendance public.ct_attendance_status,
  _hours numeric,
  _performance_rating integer,
  _safety_breach boolean,
  _remarks text,
  _reason text,
  _expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  before_state jsonb;
  after_state jsonb;
  max_hours numeric;
  used_hours numeric;
BEGIN
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'A correction needs a written reason.';
  END IF;
  SELECT * INTO c FROM public.ct_practical_task_confirmations WHERE id = _confirmation_id;
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'This record no longer exists.';
  END IF;
  IF NOT (public.ct_is_placement_mentor(c.placement_id) OR public.ct_can_access_department(c.department_id)) THEN
    RAISE EXCEPTION 'You are not allowed to correct this record.';
  END IF;
  IF _expected_version IS NOT NULL AND _expected_version <> c.version THEN
    RAISE EXCEPTION 'This record changed while you were editing it. Refresh and try again.';
  END IF;

  SELECT coalesce(max_daily_logbook_hours, 12) INTO max_hours FROM public.ct_settings LIMIT 1;
  max_hours := coalesce(max_hours, 12);
  SELECT coalesce(sum(hours), 0) INTO used_hours
  FROM public.ct_practical_task_confirmations
  WHERE placement_id = c.placement_id AND task_date = c.task_date AND id <> c.id;
  IF used_hours + coalesce(_hours, c.hours) > max_hours THEN
    RAISE EXCEPTION 'Daily limit reached: the other tasks on % already use % hour(s) and the maximum is % hour(s).', c.task_date, used_hours, max_hours;
  END IF;

  before_state := jsonb_build_object(
    'attendance', c.attendance, 'hours', c.hours, 'performance_rating', c.performance_rating,
    'safety_breach', c.safety_breach, 'remarks', c.remarks, 'status', c.status, 'version', c.version);

  UPDATE public.ct_practical_task_confirmations
     SET attendance = coalesce(_attendance, attendance),
         hours = coalesce(_hours, hours),
         performance_rating = coalesce(_performance_rating, performance_rating),
         safety_breach = coalesce(_safety_breach, safety_breach),
         remarks = nullif(_remarks, ''),
         status = 'SUBMITTED',
         decision_comment = NULL,
         decided_by = NULL,
         decided_at = NULL,
         version = version + 1,
         updated_by = auth.uid()
   WHERE id = _confirmation_id;

  SELECT jsonb_build_object(
    'attendance', attendance, 'hours', hours, 'performance_rating', performance_rating,
    'safety_breach', safety_breach, 'remarks', remarks, 'status', status, 'version', version)
    INTO after_state
  FROM public.ct_practical_task_confirmations WHERE id = _confirmation_id;

  INSERT INTO public.ct_practical_task_corrections (confirmation_id, department_id, before_state, after_state, reason, corrected_by)
  VALUES (_confirmation_id, c.department_id, before_state, after_state, btrim(_reason), auth.uid());

  INSERT INTO public.audit_logs (actor_id, action_type, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'CORRECTION', 'ct_practical_task_confirmations', _confirmation_id, before_state, after_state);

  PERFORM public.ct_log_event('practical_task_confirmation', _confirmation_id, 'CORRECTED', jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true, 'version', (after_state->>'version')::int);
END;
$$;

-- ============ coordinator aggregate (department isolation inside) ============
CREATE OR REPLACE FUNCTION public.ct_coordinator_request_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cross_dept boolean;
  my_dept uuid;
  by_status jsonb;
  by_dept jsonb;
  oldest jsonb;
BEGIN
  cross_dept := public.ct_is_admin() OR public.ct_is_ips() OR public.ct_is_program_director();
  my_dept := public.current_department_id();

  IF NOT cross_dept AND my_dept IS NULL THEN
    RETURN jsonb_build_object('cross_department', false, 'by_status', '[]'::jsonb, 'by_department', '[]'::jsonb, 'oldest_pending', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO by_status FROM (
    SELECT r.status::text AS status, count(*)::int AS total
    FROM public.ct_training_requests r
    WHERE cross_dept OR r.department_id = my_dept
    GROUP BY r.status ORDER BY r.status
  ) x;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO by_dept FROM (
    SELECT d.id AS department_id, d.name AS department_name,
           count(*)::int AS total,
           count(*) FILTER (WHERE r.status NOT IN ('APPROVED','REJECTED','CANCELLED'))::int AS open_total
    FROM public.ct_training_requests r
    JOIN public.departments d ON d.id = r.department_id
    WHERE cross_dept OR r.department_id = my_dept
    GROUP BY d.id, d.name ORDER BY d.name
  ) x;

  SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO oldest FROM (
    SELECT r.id, r.reference, r.title, r.status::text AS status, d.name AS department_name,
           r.submitted_at, r.created_at,
           GREATEST(0, EXTRACT(DAY FROM now() - coalesce(r.submitted_at, r.created_at))::int) AS age_days
    FROM public.ct_training_requests r
    JOIN public.departments d ON d.id = r.department_id
    WHERE (cross_dept OR r.department_id = my_dept)
      AND r.status NOT IN ('APPROVED','REJECTED','CANCELLED')
    ORDER BY coalesce(r.submitted_at, r.created_at) ASC
    LIMIT 25
  ) x;

  RETURN jsonb_build_object(
    'cross_department', cross_dept,
    'by_status', by_status,
    'by_department', by_dept,
    'oldest_pending', oldest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ct_confirm_practical_task(uuid, uuid, text, text, date, public.ct_attendance_status, numeric, integer, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.ct_decide_practical_task(uuid, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.ct_correct_practical_task(uuid, public.ct_attendance_status, numeric, integer, boolean, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.ct_coordinator_request_summary() FROM anon;
REVOKE ALL ON FUNCTION public.ct_is_trainer_on_active_placement(uuid) FROM anon;