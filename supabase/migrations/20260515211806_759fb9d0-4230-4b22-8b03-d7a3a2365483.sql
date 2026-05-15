
-- =====================================================================
-- TVET ERP: state machine, gatekeeper, slicing & approval engine
-- =====================================================================

-- ---- 1. Enums (idempotent) -----------------------------------------
DO $$ BEGIN
  CREATE TYPE public.session_mode AS ENUM ('Theory','Practical','Both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_type AS ENUM ('semester','session');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_decision AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new schedule_status values if missing (existing enum is schedule_status)
DO $$
DECLARE v text;
BEGIN
  FOR v IN SELECT unnest(ARRAY['DRAFT','PENDING_MA','LIVE','ACTIVE','ENDED','CANCELLED']) LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.schedule_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

DO $$
DECLARE v text;
BEGIN
  FOR v IN SELECT unnest(ARRAY['DRAFT','PENDING_MA','LIVE','ACTIVE','ENDED']) LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.semester_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

-- ---- 2. Schema additions -------------------------------------------
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS mode public.session_mode,
  ADD COLUMN IF NOT EXISTS checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE public.semester_registry
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid;

ALTER TABLE public.approval_queue
  ADD COLUMN IF NOT EXISTS type public.approval_type NOT NULL DEFAULT 'session',
  ADD COLUMN IF NOT EXISTS target_id uuid,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS decision public.approval_decision NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS comment text;

-- backfill target_id from existing schedule_id rows
UPDATE public.approval_queue SET target_id = schedule_id WHERE target_id IS NULL AND schedule_id IS NOT NULL;

ALTER TABLE public.trainer_registry
  ADD COLUMN IF NOT EXISTS sessions_target integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS sessions_completed integer NOT NULL DEFAULT 0;

-- ---- 3. Helper: legal status transitions ---------------------------
CREATE OR REPLACE FUNCTION public.enforce_schedule_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE legal boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  legal := (OLD.status, NEW.status) IN (
    ('DRAFT','PENDING_MA'),
    ('DRAFT','CANCELLED'),
    ('PENDING_MA','LIVE'),
    ('PENDING_MA','DRAFT'),
    ('PENDING_MA','CANCELLED'),
    ('LIVE','ACTIVE'),
    ('LIVE','CANCELLED'),
    ('ACTIVE','ENDED'),
    ('LIVE','ENDED')
  );
  IF NOT legal THEN
    RAISE EXCEPTION 'Illegal schedule transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_schedule_transition ON public.schedules;
CREATE TRIGGER trg_enforce_schedule_transition
  BEFORE UPDATE OF status ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.enforce_schedule_transition();

-- ---- 4. Attendance 24-hour lock ------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_attendance_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE locked timestamptz;
BEGIN
  SELECT s.attendance_locked_at INTO locked
  FROM public.attendance_logs al
  JOIN public.schedules s ON s.id = al.schedule_id
  WHERE al.id = NEW.attendance_log_id;
  IF locked IS NOT NULL AND now() > locked + interval '24 hours' THEN
    RAISE EXCEPTION '24-hour override window has expired';
  END IF;
  IF NEW.audit_comment IS NULL OR length(trim(NEW.audit_comment)) = 0 THEN
    RAISE EXCEPTION 'Audit comment is required for attendance overrides';
  END IF;
  IF NOT (public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'MA'::app_role)) THEN
    RAISE EXCEPTION 'Only DH or MA can override attendance';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_lock ON public.attendance_overrides;
CREATE TRIGGER trg_enforce_attendance_lock
  BEFORE INSERT OR UPDATE ON public.attendance_overrides
  FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_lock();

-- ---- 5. Trainer: set mode ------------------------------------------
CREATE OR REPLACE FUNCTION public.set_session_mode(_schedule_id uuid, _mode public.session_mode)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tr uuid;
BEGIN
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = _schedule_id AND trainer_registry_id = v_tr) THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;
  UPDATE schedules SET mode = _mode WHERE id = _schedule_id;
END $$;

-- ---- 6. Trainer: 30-minute / 200m gatekeeper check-in --------------
CREATE OR REPLACE FUNCTION public.trainer_checkin(
  _schedule_id uuid, _latitude numeric, _longitude numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tr uuid;
  v_sched schedules;
  v_venue venues;
  v_distance numeric;
  v_radius numeric;
  v_session_start timestamptz;
  v_session_end timestamptz;
BEGIN
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_sched FROM schedules WHERE id = _schedule_id;
  IF v_sched IS NULL OR v_sched.trainer_registry_id <> v_tr THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;
  IF v_sched.status NOT IN ('LIVE','ACTIVE') THEN
    RAISE EXCEPTION 'Session not live (status=%)', v_sched.status;
  END IF;

  v_session_start := (v_sched.date::text||' '||v_sched.start_time::text)::timestamptz;
  v_session_end   := (v_sched.date::text||' '||v_sched.end_time::text)::timestamptz;
  IF now() < v_session_start - interval '30 minutes' OR now() > v_session_end + interval '30 minutes' THEN
    RAISE EXCEPTION 'Outside 30-minute check-in window';
  END IF;

  SELECT * INTO v_venue FROM venues WHERE id = v_sched.venue_id;
  v_radius := GREATEST(COALESCE(v_venue.geo_radius, 200), 200);
  IF v_venue.latitude IS NOT NULL AND _latitude IS NOT NULL THEN
    v_distance := 6371000 * acos(LEAST(1,
      cos(radians(v_venue.latitude))*cos(radians(_latitude))
      *cos(radians(_longitude)-radians(v_venue.longitude))
      + sin(radians(v_venue.latitude))*sin(radians(_latitude))));
    IF v_distance > v_radius THEN
      RAISE EXCEPTION 'Outside venue geo-fence (% m > % m)', round(v_distance), v_radius;
    END IF;
  END IF;

  UPDATE schedules
    SET checkin_at = now(),
        status = CASE WHEN status = 'LIVE' THEN 'ACTIVE'::schedule_status ELSE status END
    WHERE id = _schedule_id;

  INSERT INTO session_logs (schedule_id, session_status, checkin_latitude, checkin_longitude, geo_verified, submitted_at)
  VALUES (_schedule_id, 'LIVE', _latitude, _longitude, true, now())
  ON CONFLICT (schedule_id) DO UPDATE
    SET checkin_latitude = EXCLUDED.checkin_latitude,
        checkin_longitude = EXCLUDED.checkin_longitude,
        geo_verified = true;

  RETURN jsonb_build_object(
    'checkin_at', now(),
    'roster_unlock_until', now() + interval '50 minutes',
    'distance_m', v_distance
  );
END $$;

-- ---- 7. Trainer: end session (LO + Lesson Plan required) -----------
CREATE OR REPLACE FUNCTION public.trainer_end_session(
  _schedule_id uuid, _learning_outcome text, _lesson_plan text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tr uuid;
BEGIN
  IF _learning_outcome IS NULL OR length(trim(_learning_outcome)) < 5 THEN
    RAISE EXCEPTION 'Learning outcome is required';
  END IF;
  IF _lesson_plan IS NULL OR length(trim(_lesson_plan)) < 5 THEN
    RAISE EXCEPTION 'Lesson plan is required';
  END IF;
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = _schedule_id AND trainer_registry_id = v_tr) THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;

  INSERT INTO session_logs (schedule_id, lesson_plan, learning_outcome, session_status, submitted_at)
  VALUES (_schedule_id, _lesson_plan, _learning_outcome, 'COMPLETED', now())
  ON CONFLICT (schedule_id) DO UPDATE
    SET lesson_plan = EXCLUDED.lesson_plan,
        learning_outcome = EXCLUDED.learning_outcome,
        session_status = 'COMPLETED',
        submitted_at = now();

  UPDATE schedules
    SET status = 'ENDED'::schedule_status,
        ended_at = now(),
        attendance_locked_at = now()
    WHERE id = _schedule_id;

  UPDATE trainer_registry SET sessions_completed = sessions_completed + 1 WHERE id = v_tr;

  RETURN jsonb_build_object('ok', true, 'ended_at', now());
END $$;

-- ---- 8. DH: swap trainer (no MA approval) --------------------------
CREATE OR REPLACE FUNCTION public.dh_swap_trainer(_schedule_id uuid, _new_trainer uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dept uuid; v_old uuid; v_sched_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) AND NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;
  SELECT department_id INTO v_dept FROM profiles WHERE id = auth.uid();
  SELECT department_id, trainer_registry_id INTO v_sched_dept, v_old FROM schedules WHERE id = _schedule_id;
  IF NOT public.has_role(auth.uid(),'MA'::app_role) AND v_sched_dept <> v_dept THEN
    RAISE EXCEPTION 'Out of department';
  END IF;
  UPDATE schedules
    SET trainer_registry_id = _new_trainer,
        hidden_staff_id = (SELECT hidden_staff_id FROM trainer_registry WHERE id = _new_trainer),
        trainer_name    = (SELECT full_name      FROM trainer_registry WHERE id = _new_trainer)
  WHERE id = _schedule_id;
  INSERT INTO audit_logs(actor_id, action_type, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'SWAP_TRAINER', 'schedules', _schedule_id::text,
          jsonb_build_object('trainer_registry_id', v_old),
          jsonb_build_object('trainer_registry_id', _new_trainer, 'reason', _reason));
END $$;

-- ---- 9. DH: override attendance ------------------------------------
CREATE OR REPLACE FUNCTION public.dh_override_attendance(
  _attendance_log_id uuid, _new_value boolean, _audit_comment text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old boolean;
BEGIN
  SELECT present INTO v_old FROM attendance_logs WHERE id = _attendance_log_id;
  INSERT INTO attendance_overrides(attendance_log_id, old_value, new_value, audit_comment, overridden_by)
  VALUES (_attendance_log_id, v_old, _new_value, _audit_comment, auth.uid());
  UPDATE attendance_logs SET present = _new_value WHERE id = _attendance_log_id;
END $$;

-- ---- 10. Approval queue: submit & decide ---------------------------
CREATE OR REPLACE FUNCTION public.submit_for_approval(
  _type public.approval_type, _target_ids uuid[]
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'MA'::app_role)) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;
  FOREACH v_id IN ARRAY _target_ids LOOP
    INSERT INTO approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES (_type, v_id, CASE WHEN _type='session' THEN v_id ELSE NULL END, auth.uid(), 'pending');
    IF _type = 'session' THEN
      UPDATE schedules SET status='PENDING_MA' WHERE id = v_id AND status='DRAFT';
    ELSE
      UPDATE semester_registry SET status='PENDING_MA' WHERE id = v_id;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.decide_approval(
  _id uuid, _decision public.approval_decision, _comment text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row approval_queue;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT * INTO v_row FROM approval_queue WHERE id = _id;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  UPDATE approval_queue
    SET decision = _decision, decided_by = auth.uid(), decided_at = now(), comment = _comment
    WHERE id = _id;

  IF _decision = 'approved' THEN
    IF v_row.type = 'session' THEN
      UPDATE schedules SET status='LIVE' WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE semester_registry SET status='LIVE', approved_by=auth.uid(), approved_at=now()
        WHERE id = v_row.target_id;
      UPDATE schedules SET status='LIVE' WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;
  ELSIF _decision = 'rejected' THEN
    IF v_row.type = 'session' THEN
      UPDATE schedules SET status='DRAFT' WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE semester_registry SET status='DRAFT' WHERE id = v_row.target_id;
      UPDATE schedules SET status='DRAFT' WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;
  END IF;
END $$;

-- ---- 11. Realtime publication --------------------------------------
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='schedules';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='session_logs';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_logs; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='attendance_logs';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='approval_queue';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_queue; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='attendance_overrides';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_overrides; END IF;
EXCEPTION WHEN others THEN NULL; END $$;
