-- ===== Enums =====
CREATE TYPE public.ct_request_status AS ENUM ('DRAFT','SUBMITTED','DELEGATED','ALLOCATED','SCHEDULED','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE public.ct_placement_status AS ENUM ('PENDING','CONFIRMED','ACTIVE','COMPLETED','WITHDRAWN');
CREATE TYPE public.ct_logbook_status AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED');
CREATE TYPE public.ct_uc_result AS ENUM ('P','NP');
CREATE TYPE public.ct_competency_rating AS ENUM ('GREEN','YELLOW','RED');
CREATE TYPE public.ct_evaluator_source AS ENUM ('TRAINER','MENTOR');
CREATE TYPE public.ct_recommendation AS ENUM ('READY_FOR_ASSESSMENT','REMEDIAL_REQUIRED','REPEAT_PLACEMENT');
CREATE TYPE public.ct_sms_status AS ENUM ('QUEUED','SENDING','SENT','DELIVERED','FAILED');

-- ===== Security helpers =====
CREATE OR REPLACE FUNCTION public.ct_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'MA'::app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.ct_is_admin() FROM anon;

CREATE OR REPLACE FUNCTION public.ct_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('MA','DH','PD','CO','VT','T'));
$$;
REVOKE EXECUTE ON FUNCTION public.ct_is_staff() FROM anon;

CREATE OR REPLACE FUNCTION public.ct_my_student_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.ct_my_student_id() FROM anon;

CREATE OR REPLACE FUNCTION public.ct_mentor_enterprise_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT enterprise_id FROM public.ct_enterprise_contacts
   WHERE user_id = auth.uid() AND active;
$$;
REVOKE EXECUTE ON FUNCTION public.ct_mentor_enterprise_ids() FROM anon;

-- ===== Requests =====
CREATE TABLE public.ct_training_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE RESTRICT,
  training_module_id uuid REFERENCES public.ct_training_modules(id) ON DELETE SET NULL,
  level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  requested_start_date date NOT NULL,
  requested_end_date date NOT NULL,
  status public.ct_request_status NOT NULL DEFAULT 'DRAFT',
  submitted_by uuid, submitted_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ct_request_dates CHECK (requested_end_date >= requested_start_date)
);
CREATE INDEX ct_req_dept_idx ON public.ct_training_requests(department_id);
CREATE INDEX ct_req_status_idx ON public.ct_training_requests(status);
CREATE INDEX ct_req_created_idx ON public.ct_training_requests(created_at DESC);

CREATE TABLE public.ct_training_request_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ct_training_requests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  theory_percent numeric,
  eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, student_id)
);
CREATE INDEX ct_reqstu_student_idx ON public.ct_training_request_students(student_id);

CREATE TABLE public.ct_request_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ct_training_requests(id) ON DELETE CASCADE,
  delegated_by uuid NOT NULL,
  delegated_to uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_deleg_req_idx ON public.ct_request_delegations(request_id);
CREATE INDEX ct_deleg_to_idx ON public.ct_request_delegations(delegated_to);

-- ===== Schedules & placements =====
CREATE TABLE public.ct_training_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ct_training_requests(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_per_week integer NOT NULL DEFAULT 5 CHECK (days_per_week BETWEEN 1 AND 7),
  daily_hours numeric NOT NULL DEFAULT 8 CHECK (daily_hours > 0),
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz, locked_by uuid,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ct_sched_dates CHECK (end_date >= start_date)
);
CREATE INDEX ct_sched_req_idx ON public.ct_training_schedules(request_id);

CREATE TABLE public.ct_student_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.ct_training_requests(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.ct_training_schedules(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enterprise_id uuid NOT NULL REFERENCES public.ct_enterprises(id) ON DELETE RESTRICT,
  training_site_id uuid REFERENCES public.ct_enterprise_training_sites(id) ON DELETE SET NULL,
  mentor_contact_id uuid REFERENCES public.ct_enterprise_contacts(id) ON DELETE SET NULL,
  visiting_trainer_id uuid REFERENCES public.trainer_registry(id) ON DELETE SET NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.ct_placement_status NOT NULL DEFAULT 'PENDING',
  locked boolean NOT NULL DEFAULT false,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ct_placement_dates CHECK (end_date >= start_date)
);
CREATE UNIQUE INDEX ct_placement_one_active_uidx
  ON public.ct_student_placements(student_id)
  WHERE status IN ('PENDING','CONFIRMED','ACTIVE');
CREATE INDEX ct_placement_ent_idx ON public.ct_student_placements(enterprise_id);
CREATE INDEX ct_placement_dept_idx ON public.ct_student_placements(department_id);
CREATE INDEX ct_placement_vt_idx ON public.ct_student_placements(visiting_trainer_id);
CREATE INDEX ct_placement_req_idx ON public.ct_student_placements(request_id);
CREATE INDEX ct_placement_status_idx ON public.ct_student_placements(status);

-- Visibility helper for placement-scoped rows
CREATE OR REPLACE FUNCTION public.ct_can_view_placement(_placement_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ct_student_placements p
    WHERE p.id = _placement_id AND (
      public.ct_is_admin()
      OR (public.has_role(auth.uid(),'DH'::app_role) AND p.department_id = public.current_department_id())
      OR public.has_role(auth.uid(),'PD'::app_role)
      OR public.has_role(auth.uid(),'CO'::app_role)
      OR p.visiting_trainer_id = public.current_trainer_registry_id()
      OR p.enterprise_id IN (SELECT public.ct_mentor_enterprise_ids())
      OR p.student_id = public.ct_my_student_id()
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.ct_can_view_placement(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.ct_is_placement_trainee(_placement_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ct_student_placements p
    WHERE p.id = _placement_id AND p.student_id = public.ct_my_student_id());
$$;
REVOKE EXECUTE ON FUNCTION public.ct_is_placement_trainee(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.ct_is_placement_mentor(_placement_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ct_student_placements p
    WHERE p.id = _placement_id
      AND p.enterprise_id IN (SELECT public.ct_mentor_enterprise_ids()));
$$;
REVOKE EXECUTE ON FUNCTION public.ct_is_placement_mentor(uuid) FROM anon;

-- ===== Day 1 check-in =====
CREATE TABLE public.ct_day1_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL UNIQUE REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  latitude numeric, longitude numeric, accuracy_meters numeric,
  distance_meters numeric, geo_verified boolean NOT NULL DEFAULT false,
  device_info text, note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Logbook =====
CREATE TABLE public.ct_daily_logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  uc_id uuid REFERENCES public.ct_units_of_competence(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.ct_training_tasks(id) ON DELETE SET NULL,
  task_description text NOT NULL,
  hours numeric NOT NULL CHECK (hours > 0),
  status public.ct_logbook_status NOT NULL DEFAULT 'DRAFT',
  client_uuid uuid UNIQUE,
  submitted_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ct_logbook_unique_task
  ON public.ct_daily_logbook_entries(placement_id, entry_date, COALESCE(task_id, '00000000-0000-0000-0000-000000000000'::uuid), md5(task_description));
CREATE INDEX ct_logbook_placement_date_idx ON public.ct_daily_logbook_entries(placement_id, entry_date);
CREATE INDEX ct_logbook_status_idx ON public.ct_daily_logbook_entries(status);

CREATE TABLE public.ct_logbook_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.ct_daily_logbook_entries(id) ON DELETE CASCADE,
  decision public.ct_logbook_status NOT NULL,
  comment text,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_logbook_appr_entry_idx ON public.ct_logbook_approvals(entry_id);

-- ===== Supervision =====
CREATE TABLE public.ct_supervision_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  visited_by uuid NOT NULL,
  latitude numeric, longitude numeric, distance_meters numeric,
  geo_verified boolean NOT NULL DEFAULT false,
  findings text, actions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_visit_placement_idx ON public.ct_supervision_visits(placement_id, visit_date);

CREATE TABLE public.ct_supervision_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.ct_supervision_visits(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_evidence_visit_idx ON public.ct_supervision_evidence(visit_id);

-- ===== Absence =====
CREATE TABLE public.ct_absence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  consecutive_days integer NOT NULL,
  reason text,
  parent_notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, from_date, to_date)
);
CREATE INDEX ct_absence_placement_idx ON public.ct_absence_events(placement_id);

-- ===== Evaluations =====
CREATE TABLE public.ct_final_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  source public.ct_evaluator_source NOT NULL,
  evaluator_id uuid,
  evaluator_name text,
  overall_comment text,
  failed_uc_count integer NOT NULL DEFAULT 0,
  red_competency_count integer NOT NULL DEFAULT 0,
  remedial_hours integer NOT NULL DEFAULT 0,
  recommendation public.ct_recommendation,
  calculation_version integer NOT NULL DEFAULT 1,
  finalized boolean NOT NULL DEFAULT false,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, source)
);
CREATE INDEX ct_eval_placement_idx ON public.ct_final_evaluations(placement_id);

CREATE TABLE public.ct_uc_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  uc_id uuid NOT NULL REFERENCES public.ct_units_of_competence(id) ON DELETE RESTRICT,
  result public.ct_uc_result NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, uc_id)
);

CREATE TABLE public.ct_basic_competency_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  competency text NOT NULL,
  rating public.ct_competency_rating NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, competency)
);

CREATE TABLE public.ct_skill_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  uc_id uuid REFERENCES public.ct_units_of_competence(id) ON DELETE SET NULL,
  competency text,
  gap_type text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_gap_placement_idx ON public.ct_skill_gaps(placement_id);

CREATE TABLE public.ct_remedial_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  description text NOT NULL,
  hours integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_remedial_placement_idx ON public.ct_remedial_actions(placement_id);

CREATE TABLE public.ct_assessment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ct_student_placements(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL UNIQUE REFERENCES public.ct_final_evaluations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'QUEUED',
  queued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_assess_student_idx ON public.ct_assessment_queue(student_id);

-- ===== SMS =====
CREATE TABLE public.ct_sms_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid REFERENCES public.ct_student_placements(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  phone text NOT NULL,
  recipient_name text,
  message text NOT NULL,
  reason text,
  status public.ct_sms_status NOT NULL DEFAULT 'QUEUED',
  retry_count integer NOT NULL DEFAULT 0,
  provider_message_id text,
  error text,
  sent_at timestamptz, delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_sms_status_idx ON public.ct_sms_queue(status, created_at);

CREATE TABLE public.ct_sms_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_id uuid NOT NULL REFERENCES public.ct_sms_queue(id) ON DELETE CASCADE,
  status public.ct_sms_status NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_smslog_sms_idx ON public.ct_sms_delivery_logs(sms_id);

-- ===== Append-only workflow events =====
CREATE TABLE public.ct_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  event_type text NOT NULL,
  actor_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_events_entity_idx ON public.ct_workflow_events(entity_type, entity_id, created_at DESC);

CREATE TRIGGER ct_workflow_events_immutable
  BEFORE UPDATE OR DELETE ON public.ct_workflow_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_logs_immutable();

-- ===== Integrity triggers =====
CREATE OR REPLACE FUNCTION public.ct_check_enterprise_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_cap integer; v_used integer; v_name text;
BEGIN
  SELECT max_capacity, name INTO v_cap, v_name FROM public.ct_enterprises WHERE id = NEW.enterprise_id;
  IF v_cap IS NULL OR v_cap = 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_used FROM public.ct_student_placements p
   WHERE p.enterprise_id = NEW.enterprise_id
     AND p.status IN ('PENDING','CONFIRMED','ACTIVE')
     AND p.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT (p.end_date < NEW.start_date OR p.start_date > NEW.end_date);
  IF v_used >= v_cap THEN
    RAISE EXCEPTION '% is full for these dates (capacity %). Choose another enterprise or change the dates.', v_name, v_cap;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ct_placement_capacity
  BEFORE INSERT OR UPDATE OF enterprise_id, start_date, end_date, status
  ON public.ct_student_placements
  FOR EACH ROW WHEN (NEW.status IN ('PENDING','CONFIRMED','ACTIVE'))
  EXECUTE FUNCTION public.ct_check_enterprise_capacity();

CREATE OR REPLACE FUNCTION public.ct_lock_placement_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked AND NOT public.ct_is_admin() THEN
    RAISE EXCEPTION 'This placement is locked. Ask an administrator to unlock it before editing.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ct_placement_lock_guard
  BEFORE UPDATE ON public.ct_student_placements
  FOR EACH ROW EXECUTE FUNCTION public.ct_lock_placement_guard();

CREATE OR REPLACE FUNCTION public.ct_logbook_lock_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'APPROVED' AND NOT public.ct_is_admin() THEN
      RAISE EXCEPTION 'Approved logbook entries cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'APPROVED' AND NEW.status = 'APPROVED'
     AND (NEW.task_description IS DISTINCT FROM OLD.task_description OR NEW.hours IS DISTINCT FROM OLD.hours) THEN
    RAISE EXCEPTION 'This day is already approved and can no longer be edited.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ct_logbook_lock
  BEFORE UPDATE OR DELETE ON public.ct_daily_logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.ct_logbook_lock_guard();

CREATE OR REPLACE FUNCTION public.ct_evaluation_lock_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.finalized AND NOT public.ct_is_admin() THEN
    RAISE EXCEPTION 'This evaluation is finalized and can no longer be changed.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ct_evaluation_lock
  BEFORE UPDATE ON public.ct_final_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.ct_evaluation_lock_guard();

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ct_training_requests','ct_training_schedules','ct_student_placements',
    'ct_daily_logbook_entries','ct_supervision_visits','ct_final_evaluations','ct_remedial_actions',
    'ct_assessment_queue','ct_sms_queue']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts()', t||'_updated_at', t);
  END LOOP;
END $$;

-- ===== Grants =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ct_training_requests','ct_training_request_students','ct_request_delegations',
    'ct_training_schedules','ct_student_placements','ct_day1_checkins','ct_daily_logbook_entries',
    'ct_logbook_approvals','ct_supervision_visits','ct_supervision_evidence','ct_absence_events',
    'ct_final_evaluations','ct_uc_evaluations','ct_basic_competency_evaluations','ct_skill_gaps',
    'ct_remedial_actions','ct_assessment_queue','ct_sms_queue','ct_sms_delivery_logs','ct_workflow_events']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ===== RLS policies =====
-- Requests: staff scoped by department/role; trainees see requests they are on
CREATE POLICY ct_req_read ON public.ct_training_requests FOR SELECT TO authenticated
USING (
  public.ct_is_admin()
  OR public.has_role(auth.uid(),'PD'::app_role)
  OR public.has_role(auth.uid(),'CO'::app_role)
  OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  OR EXISTS (SELECT 1 FROM public.ct_training_request_students rs
              WHERE rs.request_id = ct_training_requests.id AND rs.student_id = public.ct_my_student_id())
);
CREATE POLICY ct_req_write ON public.ct_training_requests FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role)
       OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role)
       OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()));

CREATE POLICY ct_reqstu_read ON public.ct_training_request_students FOR SELECT TO authenticated
USING (student_id = public.ct_my_student_id() OR public.ct_is_staff());
CREATE POLICY ct_reqstu_write ON public.ct_training_request_students FOR ALL TO authenticated
USING (public.ct_can_manage_master() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role))
WITH CHECK (public.ct_can_manage_master() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role));

CREATE POLICY ct_deleg_read ON public.ct_request_delegations FOR SELECT TO authenticated
USING (public.ct_is_staff());
CREATE POLICY ct_deleg_write ON public.ct_request_delegations FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role));

CREATE POLICY ct_sched_read ON public.ct_training_schedules FOR SELECT TO authenticated
USING (public.ct_is_staff() OR EXISTS (SELECT 1 FROM public.ct_student_placements p
   WHERE p.schedule_id = ct_training_schedules.id AND (p.student_id = public.ct_my_student_id()
      OR p.enterprise_id IN (SELECT public.ct_mentor_enterprise_ids()))));
CREATE POLICY ct_sched_write ON public.ct_training_schedules FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role) OR public.has_role(auth.uid(),'DH'::app_role));

CREATE POLICY ct_placement_read ON public.ct_student_placements FOR SELECT TO authenticated
USING (
  public.ct_is_admin()
  OR public.has_role(auth.uid(),'PD'::app_role)
  OR public.has_role(auth.uid(),'CO'::app_role)
  OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  OR visiting_trainer_id = public.current_trainer_registry_id()
  OR enterprise_id IN (SELECT public.ct_mentor_enterprise_ids())
  OR student_id = public.ct_my_student_id()
);
CREATE POLICY ct_placement_write ON public.ct_student_placements FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role)
       OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'PD'::app_role) OR public.has_role(auth.uid(),'CO'::app_role)
       OR (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id()));

CREATE POLICY ct_checkin_read ON public.ct_day1_checkins FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_checkin_insert ON public.ct_day1_checkins FOR INSERT TO authenticated
WITH CHECK (public.ct_is_placement_trainee(placement_id) OR public.ct_is_admin());

CREATE POLICY ct_logbook_read ON public.ct_daily_logbook_entries FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_logbook_trainee_write ON public.ct_daily_logbook_entries FOR INSERT TO authenticated
WITH CHECK (public.ct_is_placement_trainee(placement_id) OR public.ct_is_admin());
CREATE POLICY ct_logbook_update ON public.ct_daily_logbook_entries FOR UPDATE TO authenticated
USING (public.ct_is_placement_trainee(placement_id) OR public.ct_is_placement_mentor(placement_id) OR public.ct_is_admin())
WITH CHECK (public.ct_is_placement_trainee(placement_id) OR public.ct_is_placement_mentor(placement_id) OR public.ct_is_admin());
CREATE POLICY ct_logbook_delete ON public.ct_daily_logbook_entries FOR DELETE TO authenticated
USING (public.ct_is_placement_trainee(placement_id) OR public.ct_is_admin());

CREATE POLICY ct_logbook_appr_read ON public.ct_logbook_approvals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_daily_logbook_entries e
   WHERE e.id = entry_id AND public.ct_can_view_placement(e.placement_id)));
CREATE POLICY ct_logbook_appr_write ON public.ct_logbook_approvals FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.ct_daily_logbook_entries e
   WHERE e.id = entry_id AND (public.ct_is_placement_mentor(e.placement_id) OR public.ct_is_admin())));

CREATE POLICY ct_visit_read ON public.ct_supervision_visits FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_visit_write ON public.ct_supervision_visits FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role));

CREATE POLICY ct_evidence_read ON public.ct_supervision_evidence FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_supervision_visits v WHERE v.id = visit_id AND public.ct_can_view_placement(v.placement_id)));
CREATE POLICY ct_evidence_write ON public.ct_supervision_evidence FOR ALL TO authenticated
USING (uploaded_by = auth.uid() OR public.ct_is_admin())
WITH CHECK (uploaded_by = auth.uid() OR public.ct_is_admin());

CREATE POLICY ct_absence_read ON public.ct_absence_events FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_absence_write ON public.ct_absence_events FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'CO'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'CO'::app_role) OR public.has_role(auth.uid(),'DH'::app_role));

CREATE POLICY ct_eval_read ON public.ct_final_evaluations FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_eval_write ON public.ct_final_evaluations FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.ct_is_placement_mentor(placement_id)
       OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))
WITH CHECK (public.ct_is_admin() OR public.ct_is_placement_mentor(placement_id)
       OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role));

CREATE POLICY ct_uceval_read ON public.ct_uc_evaluations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id AND public.ct_can_view_placement(e.placement_id)));
CREATE POLICY ct_uceval_write ON public.ct_uc_evaluations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id
   AND (public.ct_is_admin() OR public.ct_is_placement_mentor(e.placement_id) OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id
   AND (public.ct_is_admin() OR public.ct_is_placement_mentor(e.placement_id) OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))));

CREATE POLICY ct_bceval_read ON public.ct_basic_competency_evaluations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id AND public.ct_can_view_placement(e.placement_id)));
CREATE POLICY ct_bceval_write ON public.ct_basic_competency_evaluations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id
   AND (public.ct_is_admin() OR public.ct_is_placement_mentor(e.placement_id) OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.ct_final_evaluations e WHERE e.id = evaluation_id
   AND (public.ct_is_admin() OR public.ct_is_placement_mentor(e.placement_id) OR public.has_role(auth.uid(),'VT'::app_role) OR public.has_role(auth.uid(),'T'::app_role) OR public.has_role(auth.uid(),'DH'::app_role))));

CREATE POLICY ct_gap_read ON public.ct_skill_gaps FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_gap_write ON public.ct_skill_gaps FOR ALL TO authenticated
USING (public.ct_is_staff()) WITH CHECK (public.ct_is_staff());

CREATE POLICY ct_remedial_read ON public.ct_remedial_actions FOR SELECT TO authenticated
USING (public.ct_can_view_placement(placement_id));
CREATE POLICY ct_remedial_write ON public.ct_remedial_actions FOR ALL TO authenticated
USING (public.ct_is_staff()) WITH CHECK (public.ct_is_staff());

CREATE POLICY ct_assess_read ON public.ct_assessment_queue FOR SELECT TO authenticated
USING (public.ct_is_staff() OR student_id = public.ct_my_student_id());
CREATE POLICY ct_assess_write ON public.ct_assessment_queue FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'CO'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'CO'::app_role));

CREATE POLICY ct_sms_read ON public.ct_sms_queue FOR SELECT TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'CO'::app_role));
CREATE POLICY ct_sms_write ON public.ct_sms_queue FOR ALL TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'CO'::app_role))
WITH CHECK (public.ct_is_admin() OR public.has_role(auth.uid(),'CO'::app_role));

CREATE POLICY ct_smslog_read ON public.ct_sms_delivery_logs FOR SELECT TO authenticated
USING (public.ct_is_admin() OR public.has_role(auth.uid(),'CO'::app_role));

CREATE POLICY ct_events_read ON public.ct_workflow_events FOR SELECT TO authenticated
USING (public.ct_is_staff());
CREATE POLICY ct_events_insert ON public.ct_workflow_events FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());