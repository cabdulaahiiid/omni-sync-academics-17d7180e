-- 1) Trainer check-in window: allow any time during the scheduled session
CREATE OR REPLACE FUNCTION public.trainer_checkin(_schedule_id uuid, _latitude numeric, _longitude numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tr uuid;
  v_sched schedules;
  v_venue venues;
  v_distance numeric;
  v_radius numeric;
  v_session_start timestamptz;
  v_session_end timestamptz;
  v_geo_enabled boolean;
  v_bypass boolean;
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
  -- Check-in allowed for the whole scheduled session (5 min grace on both ends).
  IF now() < v_session_start - interval '5 minutes' OR now() > v_session_end + interval '5 minutes' THEN
    RAISE EXCEPTION 'Outside session time (check-in opens at the scheduled start time)';
  END IF;

  SELECT geofence_enabled INTO v_geo_enabled FROM global_config LIMIT 1;
  SELECT COALESCE(bypass_geofence,false) INTO v_bypass FROM profiles WHERE id = auth.uid();

  SELECT * INTO v_venue FROM venues WHERE id = v_sched.venue_id;
  v_radius := GREATEST(COALESCE(v_venue.geo_radius, 200), 200);

  IF COALESCE(v_geo_enabled,true) AND NOT v_bypass AND v_venue.latitude IS NOT NULL AND _latitude IS NOT NULL THEN
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
    'roster_unlock_until', v_session_end,
    'distance_m', v_distance
  );
END $function$;

-- 2) Department delete preview (counts of dependents)
CREATE OR REPLACE FUNCTION public.admin_department_delete_preview(_department_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA') THEN
    RAISE EXCEPTION 'Only a Master Admin can delete a department';
  END IF;
  SELECT name INTO v_name FROM departments WHERE id = _department_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Department not found'; END IF;
  RETURN jsonb_build_object(
    'name', v_name,
    'levels', (SELECT count(*) FROM levels WHERE department_id = _department_id),
    'sections', (SELECT count(*) FROM sections WHERE department_id = _department_id),
    'students', (SELECT count(*) FROM students WHERE department_id = _department_id),
    'trainers', (SELECT count(*) FROM trainer_registry WHERE department_id = _department_id),
    'modules', (SELECT count(*) FROM modules WHERE department_id = _department_id),
    'schedules', (SELECT count(*) FROM schedules WHERE department_id = _department_id),
    'schedule_plans', (SELECT count(*) FROM schedule_plans WHERE department_id = _department_id),
    'training_requests', (SELECT count(*) FROM ct_training_requests WHERE department_id = _department_id),
    'placements', (SELECT count(*) FROM ct_student_placements WHERE department_id = _department_id),
    'users_linked', (SELECT count(*) FROM profiles WHERE department_id = _department_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_department_delete_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_department_delete_preview(uuid) TO authenticated;

-- 3) Cascade delete a department in one transaction
CREATE OR REPLACE FUNCTION public.admin_delete_department(_department_id uuid, _confirm_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
  v_counts jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA') THEN
    RAISE EXCEPTION 'Only a Master Admin can delete a department';
  END IF;
  SELECT name INTO v_name FROM departments WHERE id = _department_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Department not found'; END IF;
  IF lower(btrim(coalesce(_confirm_name,''))) <> lower(btrim(v_name)) THEN
    RAISE EXCEPTION 'Confirmation name does not match the department name';
  END IF;

  v_counts := public.admin_department_delete_preview(_department_id);

  -- practical training
  DELETE FROM ct_student_placements WHERE department_id = _department_id;
  DELETE FROM ct_training_requests WHERE department_id = _department_id;

  -- schedules (cascades attendance_logs, session_logs, approval_queue)
  DELETE FROM schedules WHERE department_id = _department_id;
  DELETE FROM schedule_plans WHERE department_id = _department_id;
  DELETE FROM schedule_feedback_threads WHERE department_id = _department_id;

  -- students
  DELETE FROM attendance_logs WHERE student_id IN (SELECT id FROM students WHERE department_id = _department_id);
  UPDATE profiles SET student_id = NULL WHERE student_id IN (SELECT id FROM students WHERE department_id = _department_id);
  DELETE FROM students WHERE department_id = _department_id;

  -- trainers
  UPDATE profiles SET trainer_registry_id = NULL
    WHERE trainer_registry_id IN (SELECT id FROM trainer_registry WHERE department_id = _department_id);
  DELETE FROM trainer_departments WHERE department_id = _department_id;
  DELETE FROM trainer_registry WHERE department_id = _department_id;

  -- curriculum structure
  DELETE FROM modules WHERE department_id = _department_id;
  DELETE FROM sections WHERE department_id = _department_id;
  DELETE FROM levels WHERE department_id = _department_id;

  -- people links
  DELETE FROM department_heads WHERE department_id = _department_id;
  UPDATE profiles SET department_id = NULL WHERE department_id = _department_id;

  DELETE FROM departments WHERE id = _department_id;

  INSERT INTO audit_logs (actor_id, action_type, entity_type, entity_id, before_state)
  VALUES (auth.uid(), 'DELETE_DEPARTMENT_CASCADE', 'departments', _department_id, v_counts);

  RETURN v_counts;
END $$;

REVOKE ALL ON FUNCTION public.admin_delete_department(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_department(uuid, text) TO authenticated;

-- 4) Atomic creation of the app-side records for a new user
CREATE OR REPLACE FUNCTION public.admin_create_user_records(
  _user_id uuid,
  _full_name text,
  _email text,
  _phone text,
  _department_id uuid,
  _role app_role,
  _avatar_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_trainer uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA') THEN
    RAISE EXCEPTION 'Only a Master Admin can create users';
  END IF;
  IF _role IN ('DH','T') AND _department_id IS NULL THEN
    RAISE EXCEPTION 'Department is required for this role';
  END IF;

  INSERT INTO profiles (id, full_name, email, phone, department_id, avatar_path)
  VALUES (_user_id, _full_name, _email, _phone, _department_id, _avatar_path)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    department_id = EXCLUDED.department_id,
    avatar_path = EXCLUDED.avatar_path;

  INSERT INTO user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _role = 'DH' THEN
    INSERT INTO department_heads (user_id, department_id) VALUES (_user_id, _department_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF _role = 'T' THEN
    INSERT INTO trainer_registry (full_name, email, phone, department_id)
    VALUES (_full_name, _email, _phone, _department_id)
    RETURNING id INTO v_trainer;
    UPDATE profiles SET trainer_registry_id = v_trainer WHERE id = _user_id;
    INSERT INTO trainer_departments (trainer_registry_id, department_id, is_primary)
    VALUES (v_trainer, _department_id, true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('user_id', _user_id, 'trainer_registry_id', v_trainer);
END $$;

REVOKE ALL ON FUNCTION public.admin_create_user_records(uuid, text, text, text, uuid, app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user_records(uuid, text, text, text, uuid, app_role, text) TO authenticated;