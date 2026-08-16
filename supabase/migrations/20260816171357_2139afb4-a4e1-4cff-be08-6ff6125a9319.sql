CREATE TABLE IF NOT EXISTS public.schedule_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semester_registry(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  module_name text NOT NULL,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  trainer_registry_id uuid NOT NULL REFERENCES public.trainer_registry(id) ON DELETE CASCADE,
  delivery text NOT NULL DEFAULT 'Theory',
  theory_days text[] NOT NULL DEFAULT '{}',
  practical_days text[] NOT NULL DEFAULT '{}',
  sessions_per_week integer NOT NULL DEFAULT 1,
  session_minutes integer NOT NULL,
  module_total_minutes integer NOT NULL,
  start_date date NOT NULL,
  start_time time NOT NULL,
  end_date date,
  total_sessions integer NOT NULL DEFAULT 0,
  total_minutes integer NOT NULL DEFAULT 0,
  weeks integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_plans TO authenticated;
GRANT ALL ON public.schedule_plans TO service_role;

ALTER TABLE public.schedule_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DH manages plans in own department"
ON public.schedule_plans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'DH'::app_role) AND department_id = public.current_department_id())
WITH CHECK (public.has_role(auth.uid(), 'DH'::app_role) AND department_id = public.current_department_id());

CREATE POLICY "MA can view all plans"
ON public.schedule_plans FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'MA'::app_role));

CREATE TRIGGER schedule_plans_set_updated_at
BEFORE UPDATE ON public.schedule_plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.schedule_plans(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS session_number integer;

CREATE INDEX IF NOT EXISTS schedules_plan_id_idx ON public.schedules(plan_id);
CREATE INDEX IF NOT EXISTS schedule_plans_department_idx ON public.schedule_plans(department_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_plans;

CREATE OR REPLACE FUNCTION public.dh_save_schedule_plan(_plan jsonb, _sessions jsonb, _plan_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dept uuid;
  v_plan_id uuid;
  v_mod record;
  v_level record;
  v_section record;
  v_venue record;
  v_trainer record;
  v_sem record;
  v_count int := 0;
  v_conflict record;
  s jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DH'::app_role) THEN
    RAISE EXCEPTION 'Department Head only';
  END IF;
  v_dept := public.current_department_id();
  IF v_dept IS NULL THEN
    RAISE EXCEPTION 'No department assigned to this Department Head account.';
  END IF;
  IF (_plan->>'department_id')::uuid <> v_dept THEN
    RAISE EXCEPTION 'Out of department';
  END IF;
  IF _sessions IS NULL OR jsonb_array_length(_sessions) = 0 THEN
    RAISE EXCEPTION 'No sessions to save — check teaching days, duration and start date.';
  END IF;

  SELECT * INTO v_sem FROM public.semester_registry WHERE id = (_plan->>'semester_id')::uuid;
  IF v_sem IS NULL THEN RAISE EXCEPTION 'The selected academic term no longer exists.'; END IF;

  SELECT * INTO v_level FROM public.levels WHERE id = (_plan->>'level_id')::uuid;
  IF v_level IS NULL THEN RAISE EXCEPTION 'The selected Level no longer exists.'; END IF;
  IF v_level.department_id <> v_dept THEN RAISE EXCEPTION 'That Level does not belong to your department.'; END IF;

  SELECT * INTO v_mod FROM public.modules WHERE id = (_plan->>'module_id')::uuid;
  IF v_mod IS NULL THEN RAISE EXCEPTION 'The selected Module no longer exists.'; END IF;
  IF v_mod.department_id <> v_dept THEN RAISE EXCEPTION 'That Module does not belong to your department.'; END IF;
  IF v_mod.level_id <> v_level.id THEN
    RAISE EXCEPTION 'Module % belongs to a different Level. Choose a module for the selected Level.', v_mod.code;
  END IF;

  SELECT * INTO v_section FROM public.sections WHERE id = (_plan->>'section_id')::uuid;
  IF v_section IS NULL THEN RAISE EXCEPTION 'The selected Section no longer exists.'; END IF;
  IF v_section.department_id <> v_dept THEN RAISE EXCEPTION 'That Section does not belong to your department.'; END IF;
  IF v_section.level_id <> v_level.id THEN RAISE EXCEPTION 'That Section does not belong to the selected Level.'; END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = (_plan->>'venue_id')::uuid;
  IF v_venue IS NULL THEN RAISE EXCEPTION 'The selected Venue no longer exists.'; END IF;

  SELECT * INTO v_trainer FROM public.trainer_registry WHERE id = (_plan->>'trainer_registry_id')::uuid;
  IF v_trainer IS NULL THEN RAISE EXCEPTION 'The selected Trainer no longer exists.'; END IF;
  IF v_trainer.department_id <> v_dept AND NOT EXISTS (
    SELECT 1 FROM public.trainer_departments td
     WHERE td.trainer_registry_id = v_trainer.id AND td.department_id = v_dept
  ) THEN
    RAISE EXCEPTION 'That Trainer is not assigned to your department.';
  END IF;

  -- Replacing an existing plan: drop its draft sessions first (same transaction).
  IF _plan_id IS NOT NULL THEN
    SELECT id INTO v_plan_id FROM public.schedule_plans WHERE id = _plan_id AND department_id = v_dept;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Plan not found in your department'; END IF;
    IF EXISTS (SELECT 1 FROM public.schedules WHERE plan_id = v_plan_id AND status <> 'DRAFT'::schedule_status) THEN
      RAISE EXCEPTION 'This schedule has already been submitted and can no longer be regenerated.';
    END IF;
    DELETE FROM public.approval_queue
      WHERE type = 'session' AND decision = 'pending'
        AND schedule_id IN (SELECT id FROM public.schedules WHERE plan_id = v_plan_id);
    DELETE FROM public.schedules WHERE plan_id = v_plan_id;
  END IF;

  -- Conflict detection on the real generated session time ranges.
  SELECT o.date, o.start_time, o.end_time, x.module_code, x.trainer_registry_id, x.venue_id, x.section_id
    INTO v_conflict
    FROM jsonb_to_recordset(_sessions) AS o(date date, start_time time, end_time time)
    JOIN public.schedules x
      ON x.date = o.date
     AND x.status IN ('DRAFT','PENDING_MA','LIVE','ACTIVE')
     AND (v_plan_id IS NULL OR x.plan_id IS DISTINCT FROM v_plan_id)
     AND o.start_time < x.end_time AND o.end_time > x.start_time
     AND (
          x.trainer_registry_id = v_trainer.id
       OR x.venue_id = v_venue.id
       OR (x.section_id = v_section.id AND x.department_id = v_dept)
     )
   LIMIT 1;

  IF v_conflict.date IS NOT NULL THEN
    RAISE EXCEPTION 'Clash on % at %–%: % is already booked. Change the time, day, trainer or venue.',
      v_conflict.date, to_char(v_conflict.start_time,'HH24:MI'), to_char(v_conflict.end_time,'HH24:MI'),
      CASE WHEN v_conflict.trainer_registry_id = v_trainer.id THEN 'the trainer'
           WHEN v_conflict.venue_id = v_venue.id THEN 'the venue'
           ELSE 'the section' END;
  END IF;

  INSERT INTO public.schedule_plans (
    id, semester_id, department_id, level_id, module_id, module_code, module_name,
    section_id, venue_id, trainer_registry_id, delivery, theory_days, practical_days,
    sessions_per_week, session_minutes, module_total_minutes, start_date, start_time,
    end_date, total_sessions, total_minutes, weeks, created_by
  ) VALUES (
    COALESCE(v_plan_id, gen_random_uuid()),
    (_plan->>'semester_id')::uuid, v_dept, v_level.id, v_mod.id, v_mod.code, v_mod.name,
    v_section.id, v_venue.id, v_trainer.id,
    COALESCE(_plan->>'delivery','Theory'),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(_plan->'theory_days','[]'::jsonb)) value), '{}'),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(_plan->'practical_days','[]'::jsonb)) value), '{}'),
    COALESCE((_plan->>'sessions_per_week')::int, 1),
    (_plan->>'session_minutes')::int,
    (_plan->>'module_total_minutes')::int,
    (_plan->>'start_date')::date,
    (_plan->>'start_time')::time,
    (_plan->>'end_date')::date,
    COALESCE((_plan->>'total_sessions')::int, 0),
    COALESCE((_plan->>'total_minutes')::int, 0),
    COALESCE((_plan->>'weeks')::int, 0),
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    semester_id = EXCLUDED.semester_id, level_id = EXCLUDED.level_id,
    module_id = EXCLUDED.module_id, module_code = EXCLUDED.module_code, module_name = EXCLUDED.module_name,
    section_id = EXCLUDED.section_id, venue_id = EXCLUDED.venue_id,
    trainer_registry_id = EXCLUDED.trainer_registry_id, delivery = EXCLUDED.delivery,
    theory_days = EXCLUDED.theory_days, practical_days = EXCLUDED.practical_days,
    sessions_per_week = EXCLUDED.sessions_per_week, session_minutes = EXCLUDED.session_minutes,
    module_total_minutes = EXCLUDED.module_total_minutes, start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time, end_date = EXCLUDED.end_date,
    total_sessions = EXCLUDED.total_sessions, total_minutes = EXCLUDED.total_minutes,
    weeks = EXCLUDED.weeks
  RETURNING id INTO v_plan_id;

  FOR s IN SELECT * FROM jsonb_array_elements(_sessions) LOOP
    INSERT INTO public.schedules (
      semester_id, department_id, level_id, section_id, venue_id,
      module_code, module_name, trainer_registry_id, hidden_staff_id, trainer_name,
      date, day, week_num, start_time, end_time, status, created_by,
      plan_id, session_number, mode
    ) VALUES (
      (_plan->>'semester_id')::uuid, v_dept, v_level.id, v_section.id, v_venue.id,
      v_mod.code, v_mod.name, v_trainer.id, v_trainer.hidden_staff_id, v_trainer.full_name,
      (s->>'date')::date, s->>'day', (s->>'week_num')::int,
      (s->>'start_time')::time, (s->>'end_time')::time,
      'DRAFT'::schedule_status, auth.uid(),
      v_plan_id, (s->>'session_number')::int,
      NULLIF(s->>'mode','')::session_mode
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.semester_registry SET distribution_status = 'DRAFT'
   WHERE id = (_plan->>'semester_id')::uuid AND distribution_status NOT IN ('PENDING_MA','PUBLISHED');

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), CASE WHEN _plan_id IS NULL THEN 'DH_SAVE_SCHEDULE_PLAN' ELSE 'DH_REGENERATE_SCHEDULE_PLAN' END,
          'schedule_plans', v_plan_id::text,
          jsonb_build_object('module', v_mod.code, 'sessions', v_count,
                             'weeks', (_plan->>'weeks')::int, 'end_date', _plan->>'end_date'));

  RETURN jsonb_build_object('ok', true, 'plan_id', v_plan_id, 'sessions', v_count);
END
$function$;

REVOKE ALL ON FUNCTION public.dh_save_schedule_plan(jsonb, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dh_save_schedule_plan(jsonb, jsonb, uuid) TO authenticated;