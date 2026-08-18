
-- 1. Widen the DH gate: every department gets its own module (policies already scope by department_id)
CREATE OR REPLACE FUNCTION public.ct_is_industrial_dh()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'DH'::app_role)
     AND public.current_department_id() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.ct_can_access_department(_department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.ct_is_admin()
      OR public.ct_is_ips()
      OR (public.has_role(auth.uid(),'DH'::app_role) AND _department_id = public.current_department_id())
      OR EXISTS (SELECT 1 FROM public.trainer_departments td
                 WHERE td.trainer_registry_id = public.current_trainer_registry_id()
                   AND td.department_id = _department_id);
$$;

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE public.ct_attendance_status AS ENUM ('PRESENT','LATE','ABSENT','EXCUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ct_status_color AS ENUM ('GREEN','YELLOW','RED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ct_gap_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.ct_request_status ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE public.ct_request_status ADD VALUE IF NOT EXISTS 'MODIFIED';

-- 3. Per-department competency checklist
CREATE TABLE IF NOT EXISTS public.ct_department_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  critical boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_department_competencies TO authenticated;
GRANT ALL ON public.ct_department_competencies TO service_role;
ALTER TABLE public.ct_department_competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_dept_comp_read ON public.ct_department_competencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ct_dept_comp_write ON public.ct_department_competencies
  FOR ALL TO authenticated
  USING (public.ct_is_admin() OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()))
  WITH CHECK (public.ct_is_admin() OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()));
CREATE INDEX IF NOT EXISTS ct_dept_comp_dept_idx ON public.ct_department_competencies(department_id, sort_order);
CREATE TRIGGER ct_dept_comp_touch BEFORE UPDATE ON public.ct_department_competencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

-- 4. Per-department evaluation configuration
CREATE TABLE IF NOT EXISTS public.ct_department_eval_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL UNIQUE REFERENCES public.departments(id) ON DELETE CASCADE,
  weight_daily numeric NOT NULL DEFAULT 40,
  weight_industry numeric NOT NULL DEFAULT 40,
  weight_tvet numeric NOT NULL DEFAULT 20,
  passing_threshold numeric NOT NULL DEFAULT 60,
  attendance_threshold numeric NOT NULL DEFAULT 80,
  max_allowed_gaps integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_department_eval_configs TO authenticated;
GRANT ALL ON public.ct_department_eval_configs TO service_role;
ALTER TABLE public.ct_department_eval_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_dept_cfg_read ON public.ct_department_eval_configs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ct_dept_cfg_write ON public.ct_department_eval_configs
  FOR ALL TO authenticated
  USING (public.ct_is_admin() OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()))
  WITH CHECK (public.ct_is_admin() OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()));
CREATE TRIGGER ct_dept_cfg_touch BEFORE UPDATE ON public.ct_department_eval_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

-- 5. Daily practical logs (industry trainer)
CREATE TABLE IF NOT EXISTS public.ct_daily_practical_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  attendance public.ct_attendance_status NOT NULL DEFAULT 'PRESENT',
  shift_hours numeric NOT NULL DEFAULT 8,
  score integer,
  safety_breach boolean NOT NULL DEFAULT false,
  task_notes text,
  safety_notes text,
  gap_tags text[] NOT NULL DEFAULT '{}',
  client_uuid uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_daily_practical_logs TO authenticated;
GRANT ALL ON public.ct_daily_practical_logs TO service_role;
ALTER TABLE public.ct_daily_practical_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_daily_log_read ON public.ct_daily_practical_logs
  FOR SELECT TO authenticated USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_daily_log_write ON public.ct_daily_practical_logs
  FOR ALL TO authenticated
  USING (public.ct_is_admin() OR public.ct_is_placement_mentor(placement_id) OR public.ct_is_ips())
  WITH CHECK (public.ct_is_admin() OR public.ct_is_placement_mentor(placement_id) OR public.ct_is_ips());
CREATE INDEX IF NOT EXISTS ct_daily_log_placement_idx ON public.ct_daily_practical_logs(placement_id, log_date);
CREATE UNIQUE INDEX IF NOT EXISTS ct_daily_log_client_uuid_idx ON public.ct_daily_practical_logs(client_uuid) WHERE client_uuid IS NOT NULL;
CREATE TRIGGER ct_daily_log_touch BEFORE UPDATE ON public.ct_daily_practical_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

-- 6. Remediation plans
CREATE TABLE IF NOT EXISTS public.ct_remediation_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  assigned_trainer_id uuid REFERENCES public.trainer_registry(id) ON DELETE SET NULL,
  focus_areas text[] NOT NULL DEFAULT '{}',
  hours numeric NOT NULL DEFAULT 0,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_remediation_plans TO authenticated;
GRANT ALL ON public.ct_remediation_plans TO service_role;
ALTER TABLE public.ct_remediation_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY ct_remediation_read ON public.ct_remediation_plans
  FOR SELECT TO authenticated USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_remediation_write ON public.ct_remediation_plans
  FOR ALL TO authenticated USING (public.ct_is_staff()) WITH CHECK (public.ct_is_staff());
CREATE TRIGGER ct_remediation_touch BEFORE UPDATE ON public.ct_remediation_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

-- 7. Extra columns on skill gaps and final evaluations
ALTER TABLE public.ct_skill_gaps ADD COLUMN IF NOT EXISTS severity public.ct_gap_severity NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE public.ct_skill_gaps ADD COLUMN IF NOT EXISTS tag text;

ALTER TABLE public.ct_final_evaluations
  ADD COLUMN IF NOT EXISTS daily_avg_score numeric,
  ADD COLUMN IF NOT EXISTS attendance_rate numeric,
  ADD COLUMN IF NOT EXISTS industry_score numeric,
  ADD COLUMN IF NOT EXISTS tvet_score numeric,
  ADD COLUMN IF NOT EXISTS composite_score numeric,
  ADD COLUMN IF NOT EXISTS status_color public.ct_status_color,
  ADD COLUMN IF NOT EXISTS safety_breach_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weights_used jsonb;

-- 8. Department config upsert
CREATE OR REPLACE FUNCTION public.ct_upsert_department_config(
  _department_id uuid, _weight_daily numeric, _weight_industry numeric, _weight_tvet numeric,
  _passing_threshold numeric, _attendance_threshold numeric, _max_allowed_gaps integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.ct_is_admin() OR (public.has_role(auth.uid(),'DH'::app_role) AND _department_id = public.current_department_id())) THEN
    RAISE EXCEPTION 'You can only configure your own department.';
  END IF;
  IF round(_weight_daily + _weight_industry + _weight_tvet) <> 100 THEN
    RAISE EXCEPTION 'The three weights must add up to 100 (currently %).', (_weight_daily + _weight_industry + _weight_tvet);
  END IF;
  INSERT INTO public.ct_department_eval_configs AS c
    (department_id, weight_daily, weight_industry, weight_tvet, passing_threshold, attendance_threshold, max_allowed_gaps, created_by, updated_by)
  VALUES (_department_id, _weight_daily, _weight_industry, _weight_tvet, _passing_threshold, _attendance_threshold, COALESCE(_max_allowed_gaps,0), auth.uid(), auth.uid())
  ON CONFLICT (department_id) DO UPDATE
    SET weight_daily=EXCLUDED.weight_daily, weight_industry=EXCLUDED.weight_industry,
        weight_tvet=EXCLUDED.weight_tvet, passing_threshold=EXCLUDED.passing_threshold,
        attendance_threshold=EXCLUDED.attendance_threshold, max_allowed_gaps=EXCLUDED.max_allowed_gaps,
        updated_by=auth.uid()
  RETURNING c.id INTO v_id;
  PERFORM public.ct_log_event('ct_department_eval_configs', v_id, 'CT_DEPT_CONFIG_SAVED', jsonb_build_object('department_id', _department_id));
  RETURN v_id;
END $$;

-- 9. Daily log submission (idempotent by client uuid, offline friendly)
CREATE OR REPLACE FUNCTION public.ct_submit_daily_log(
  _client_uuid uuid, _placement_id uuid, _log_date date, _attendance public.ct_attendance_status,
  _shift_hours numeric, _score integer, _safety_breach boolean, _task_notes text,
  _safety_notes text, _gap_tags text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.ct_is_admin() OR public.ct_is_ips() OR public.ct_is_placement_mentor(_placement_id)) THEN
    RAISE EXCEPTION 'Only the assigned industry trainer can record daily logs for this trainee.';
  END IF;
  IF _score IS NOT NULL AND (_score < 1 OR _score > 5) THEN
    RAISE EXCEPTION 'The daily score must be between 1 and 5.';
  END IF;
  IF _client_uuid IS NOT NULL THEN
    SELECT id INTO v_id FROM public.ct_daily_practical_logs WHERE client_uuid = _client_uuid;
    IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id', v_id, 'duplicate', true); END IF;
  END IF;
  INSERT INTO public.ct_daily_practical_logs AS l
    (placement_id, log_date, attendance, shift_hours, score, safety_breach, task_notes, safety_notes, gap_tags, client_uuid, created_by, updated_by)
  VALUES (_placement_id, _log_date, COALESCE(_attendance,'PRESENT'), COALESCE(_shift_hours,8), _score,
          COALESCE(_safety_breach,false), _task_notes, _safety_notes, COALESCE(_gap_tags,'{}'), _client_uuid, auth.uid(), auth.uid())
  ON CONFLICT (placement_id, log_date) DO UPDATE
    SET attendance=EXCLUDED.attendance, shift_hours=EXCLUDED.shift_hours, score=EXCLUDED.score,
        safety_breach=EXCLUDED.safety_breach, task_notes=EXCLUDED.task_notes,
        safety_notes=EXCLUDED.safety_notes, gap_tags=EXCLUDED.gap_tags, updated_by=auth.uid()
  RETURNING l.id INTO v_id;
  PERFORM public.ct_log_event('ct_daily_practical_logs', v_id, 'CT_DAILY_LOG', jsonb_build_object('placement_id', _placement_id, 'date', _log_date));
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END $$;

-- 10. Supervisor HOLD and MODIFY
CREATE OR REPLACE FUNCTION public.ct_ips_hold_request(_request_id uuid, _hold_reason text, _expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can place a request on hold.';
  END IF;
  IF _hold_reason IS NULL OR length(btrim(_hold_reason)) < 5 THEN
    RAISE EXCEPTION 'Give a reason for placing this request on hold.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
  IF v_status IN ('COMPLETED','CANCELLED','REJECTED') THEN
    RAISE EXCEPTION 'This request can no longer be placed on hold (%).', v_status;
  END IF;
  UPDATE public.ct_training_requests
     SET status='ON_HOLD', decision_note=_hold_reason, decided_at=now(), ips_actor_id=auth.uid(),
         version=version+1, updated_by=auth.uid()
   WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'HOLD', v_status, 'ON_HOLD'::public.ct_request_status, _hold_reason, NULL);
  RETURN jsonb_build_object('status','ON_HOLD');
END $$;

CREATE OR REPLACE FUNCTION public.ct_ips_modify_request(
  _request_id uuid, _start_date date, _end_date date, _training_module_id uuid,
  _note text, _expected_version integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status public.ct_request_status; v_version integer;
BEGIN
  IF NOT (public.ct_is_ips() OR public.ct_is_admin()) THEN
    RAISE EXCEPTION 'Only the Industrial Practical Supervisor can modify a request.';
  END IF;
  SELECT status, version INTO v_status, v_version FROM public.ct_training_requests WHERE id=_request_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Request not found.'; END IF;
  PERFORM public.ct_assert_version(v_version, _expected_version);
  IF v_status IN ('COMPLETED','CANCELLED','REJECTED') THEN
    RAISE EXCEPTION 'This request can no longer be modified (%).', v_status;
  END IF;
  IF _start_date IS NOT NULL AND _end_date IS NOT NULL AND _end_date < _start_date THEN
    RAISE EXCEPTION 'The end date must fall after the start date.';
  END IF;
  UPDATE public.ct_training_requests
     SET requested_start_date = COALESCE(_start_date, requested_start_date),
         requested_end_date = COALESCE(_end_date, requested_end_date),
         training_module_id = COALESCE(_training_module_id, training_module_id),
         decision_note = COALESCE(_note, decision_note),
         ips_actor_id = auth.uid(), version = version+1, updated_by = auth.uid()
   WHERE id=_request_id;
  PERFORM public.ct_record_decision(_request_id, 'MODIFY', v_status, v_status, _note, NULL);
  RETURN jsonb_build_object('status', v_status);
END $$;

-- 11. Evaluation engine: composite score + 3 colour status
CREATE OR REPLACE FUNCTION public.ct_finalize_evaluation(_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_e public.ct_final_evaluations; v_failed int; v_red int; v_total int;
        v_hours int; v_rec ct_recommendation; v_cfg public.ct_settings;
        v_dept uuid; v_dcfg public.ct_department_eval_configs;
        v_wd numeric; v_wi numeric; v_wt numeric; v_pass numeric; v_attn numeric; v_maxgaps int;
        v_daily numeric; v_rate numeric; v_ind numeric; v_tvet numeric; v_comp numeric;
        v_days int; v_present numeric; v_safety int; v_gaps int; v_color public.ct_status_color;
        v_trainer uuid; v_focus text[];
BEGIN
  PERFORM public.ct_require_any(ARRAY['MA','DH','VT','T','CO','EM','IPS']::app_role[]);
  SELECT * INTO v_e FROM public.ct_final_evaluations WHERE id=_evaluation_id;
  IF v_e.id IS NULL THEN RAISE EXCEPTION 'Evaluation not found.'; END IF;
  IF v_e.finalized THEN RAISE EXCEPTION 'This evaluation is already finalized.'; END IF;
  SELECT * INTO v_cfg FROM public.ct_settings LIMIT 1;
  SELECT department_id, visiting_trainer_id INTO v_dept, v_trainer
    FROM public.ct_student_placements WHERE id = v_e.placement_id;
  SELECT * INTO v_dcfg FROM public.ct_department_eval_configs WHERE department_id = v_dept;

  v_wd := COALESCE(v_dcfg.weight_daily, 40);
  v_wi := COALESCE(v_dcfg.weight_industry, 40);
  v_wt := COALESCE(v_dcfg.weight_tvet, 20);
  v_pass := COALESCE(v_dcfg.passing_threshold, 60);
  v_attn := COALESCE(v_dcfg.attendance_threshold, 80);
  v_maxgaps := COALESCE(v_dcfg.max_allowed_gaps, 0);

  SELECT COUNT(*) FILTER (WHERE result='NP'), COUNT(*) INTO v_failed, v_total
    FROM public.ct_uc_evaluations WHERE evaluation_id=_evaluation_id;
  SELECT COUNT(*) FILTER (WHERE rating='RED') INTO v_red
    FROM public.ct_basic_competency_evaluations WHERE evaluation_id=_evaluation_id;

  -- daily logs → daily average (1-5 scaled to 0-100), attendance rate, safety breaches
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE attendance='PRESENT') + 0.5 * COUNT(*) FILTER (WHERE attendance='LATE'),
         AVG(score) FILTER (WHERE score IS NOT NULL),
         COUNT(*) FILTER (WHERE safety_breach)
    INTO v_days, v_present, v_daily, v_safety
    FROM public.ct_daily_practical_logs WHERE placement_id = v_e.placement_id;

  v_daily := CASE WHEN v_daily IS NULL THEN NULL ELSE round(((v_daily - 1) / 4) * 100, 2) END;
  v_rate := CASE WHEN COALESCE(v_days,0) > 0 THEN round((v_present / v_days) * 100, 2) ELSE 100 END;

  -- industry / tvet evaluation score from unit results of this evaluation
  v_ind := CASE WHEN v_total > 0 THEN round(((v_total - v_failed)::numeric / v_total) * 100, 2) ELSE NULL END;
  v_tvet := COALESCE((SELECT round(((COUNT(*) - COUNT(*) FILTER (WHERE ue.result='NP'))::numeric
                        / NULLIF(COUNT(*),0)) * 100, 2)
                       FROM public.ct_final_evaluations fe
                       JOIN public.ct_uc_evaluations ue ON ue.evaluation_id = fe.id
                      WHERE fe.placement_id = v_e.placement_id AND fe.source = 'TRAINER'), v_ind);
  v_ind := COALESCE(v_ind, 0); v_tvet := COALESCE(v_tvet, 0); v_daily := COALESCE(v_daily, v_ind);
  v_comp := round((v_wd * v_daily + v_wi * v_ind + v_wt * v_tvet) / 100, 2);

  v_hours := v_failed * COALESCE(v_cfg.remedial_hours_per_failed_uc, 8)
           + v_red * COALESCE(v_cfg.remedial_hours_per_red_competency, 4);

  IF v_failed = 0 AND v_red <= COALESCE(v_cfg.max_red_competencies_for_assessment, 0) THEN
    v_rec := 'READY_FOR_ASSESSMENT';
  ELSIF v_total > 0 AND v_failed::numeric / v_total >= 0.5 THEN
    v_rec := 'REPEAT_PLACEMENT';
  ELSE
    v_rec := 'REMEDIAL_REQUIRED';
  END IF;

  DELETE FROM public.ct_skill_gaps WHERE evaluation_id=_evaluation_id;
  INSERT INTO public.ct_skill_gaps(placement_id, evaluation_id, uc_id, gap_type, detail, tag, severity)
  SELECT v_e.placement_id, _evaluation_id, ue.uc_id, 'UC_NOT_COMPETENT', u.name, u.name, 'HIGH'
    FROM public.ct_uc_evaluations ue JOIN public.ct_units_of_competence u ON u.id=ue.uc_id
   WHERE ue.evaluation_id=_evaluation_id AND ue.result='NP';
  INSERT INTO public.ct_skill_gaps(placement_id, evaluation_id, competency, gap_type, detail, tag, severity)
  SELECT v_e.placement_id, _evaluation_id, bc.competency, 'BASIC_COMPETENCY_RED', bc.comment, bc.competency, 'MEDIUM'
    FROM public.ct_basic_competency_evaluations bc
   WHERE bc.evaluation_id=_evaluation_id AND bc.rating='RED';
  INSERT INTO public.ct_skill_gaps(placement_id, evaluation_id, gap_type, detail, tag, severity)
  SELECT DISTINCT v_e.placement_id, _evaluation_id, 'FIELD_SKILL_GAP', t, t, 'MEDIUM'
    FROM public.ct_daily_practical_logs l, unnest(l.gap_tags) AS t
   WHERE l.placement_id = v_e.placement_id AND btrim(t) <> '';

  SELECT COUNT(*) INTO v_gaps FROM public.ct_skill_gaps WHERE evaluation_id=_evaluation_id;

  IF v_comp < v_pass OR v_rate < v_attn OR COALESCE(v_safety,0) > 0 THEN
    v_color := 'RED';
  ELSIF v_gaps > v_maxgaps THEN
    v_color := 'YELLOW';
  ELSE
    v_color := 'GREEN';
  END IF;

  UPDATE public.ct_final_evaluations
     SET failed_uc_count=v_failed, red_competency_count=v_red, remedial_hours=v_hours,
         recommendation=v_rec, calculation_version=COALESCE(v_cfg.calculation_version,1),
         daily_avg_score=v_daily, attendance_rate=v_rate, industry_score=v_ind, tvet_score=v_tvet,
         composite_score=v_comp, status_color=v_color, safety_breach_count=COALESCE(v_safety,0),
         weights_used=jsonb_build_object('daily',v_wd,'industry',v_wi,'tvet',v_wt,
            'passing_threshold',v_pass,'attendance_threshold',v_attn,'max_allowed_gaps',v_maxgaps),
         finalized=true, finalized_at=now()
   WHERE id=_evaluation_id;

  DELETE FROM public.ct_remedial_actions WHERE evaluation_id=_evaluation_id AND NOT completed;
  IF v_hours > 0 THEN
    INSERT INTO public.ct_remedial_actions(placement_id, evaluation_id, description, hours)
    VALUES (v_e.placement_id, _evaluation_id,
      'Remedial training for ' || v_failed || ' unit(s) not yet competent and ' || v_red || ' weak basic competency(ies).',
      v_hours);
  END IF;

  DELETE FROM public.ct_remediation_plans WHERE evaluation_id=_evaluation_id AND NOT completed;
  IF v_color = 'YELLOW' THEN
    SELECT array_agg(DISTINCT COALESCE(tag, detail)) INTO v_focus
      FROM public.ct_skill_gaps WHERE evaluation_id=_evaluation_id;
    INSERT INTO public.ct_remediation_plans(placement_id, evaluation_id, assigned_trainer_id, focus_areas, hours, notes)
    VALUES (v_e.placement_id, _evaluation_id, v_trainer, COALESCE(v_focus,'{}'), GREATEST(v_hours, 4),
      'Targeted remediation plan generated automatically from the skill gaps recorded during this placement.');
  END IF;

  PERFORM public.ct_log_event('ct_final_evaluations', _evaluation_id, 'CT_FINALIZE_EVALUATION',
    jsonb_build_object('composite', v_comp, 'attendance_rate', v_rate, 'color', v_color,
                       'failed_uc', v_failed, 'red', v_red, 'hours', v_hours, 'recommendation', v_rec));

  RETURN jsonb_build_object('failed_uc_count', v_failed, 'red_competency_count', v_red,
    'remedial_hours', v_hours, 'recommendation', v_rec, 'composite_score', v_comp,
    'daily_avg_score', v_daily, 'attendance_rate', v_rate, 'status_color', v_color,
    'safety_breach_count', COALESCE(v_safety,0), 'skill_gap_count', v_gaps);
END $$;
