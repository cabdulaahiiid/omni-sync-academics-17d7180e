ALTER TABLE public.global_config ADD COLUMN IF NOT EXISTS geofence_enabled boolean NOT NULL DEFAULT true;

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
  IF now() < v_session_start - interval '30 minutes' OR now() > v_session_end + interval '30 minutes' THEN
    RAISE EXCEPTION 'Outside 30-minute check-in window';
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
    'roster_unlock_until', now() + interval '50 minutes',
    'distance_m', v_distance
  );
END $function$;

CREATE OR REPLACE FUNCTION public.submit_session_batch(_client_uuid uuid, _schedule_id uuid, _client_timestamp timestamp with time zone, _lesson_plan text, _learning_outcome text, _latitude numeric, _longitude numeric, _attendance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer_id uuid;
  v_existing public.pending_sync;
  v_schedule public.schedules;
  v_venue public.venues;
  v_window int;
  v_geo_ok boolean := true;
  v_window_ok boolean := true;
  v_geo_distance numeric;
  v_session_start timestamptz;
  v_attendance_count int := 0;
  v_status text := 'applied';
  v_reason text;
  v_result jsonb;
  v_geo_enabled boolean;
  v_bypass boolean;
  r jsonb;
BEGIN
  SELECT trainer_registry_id INTO v_trainer_id FROM public.profiles WHERE id = auth.uid();
  IF v_trainer_id IS NULL THEN RAISE EXCEPTION 'Not a trainer'; END IF;

  SELECT * INTO v_existing FROM public.pending_sync WHERE client_uuid = _client_uuid;
  IF FOUND THEN
    RETURN jsonb_build_object('status', v_existing.status, 'conflict_reason', v_existing.conflict_reason, 'replayed', true, 'result', v_existing.result);
  END IF;

  SELECT * INTO v_schedule FROM public.schedules WHERE id = _schedule_id;
  IF NOT FOUND OR v_schedule.trainer_registry_id <> v_trainer_id THEN
    RAISE EXCEPTION 'Unauthorized for this schedule';
  END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = v_schedule.venue_id;
  SELECT attendance_window_minutes, geofence_enabled INTO v_window, v_geo_enabled FROM public.global_config LIMIT 1;
  v_window := COALESCE(v_window, 15);
  SELECT COALESCE(bypass_geofence,false) INTO v_bypass FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_geo_enabled,true) AND NOT v_bypass AND _latitude IS NOT NULL AND _longitude IS NOT NULL AND v_venue.latitude IS NOT NULL THEN
    v_geo_distance := 6371000 * acos(
      LEAST(1, cos(radians(v_venue.latitude)) * cos(radians(_latitude))
        * cos(radians(_longitude) - radians(v_venue.longitude))
        + sin(radians(v_venue.latitude)) * sin(radians(_latitude)))
    );
    IF v_geo_distance > COALESCE(v_venue.geo_radius, 50) THEN
      v_geo_ok := false;
      v_status := 'rejected';
      v_reason := 'geo_fence';
    END IF;
  END IF;

  v_session_start := (v_schedule.date::text || ' ' || v_schedule.start_time::text)::timestamptz;
  IF _client_timestamp < v_session_start - (v_window || ' minutes')::interval
     OR _client_timestamp > v_session_start + (v_schedule.end_time - v_schedule.start_time) + (v_window || ' minutes')::interval THEN
    v_window_ok := false;
    IF v_status = 'applied' THEN
      v_status := 'rejected';
      v_reason := 'window_expired';
    END IF;
  END IF;

  IF v_status = 'applied' THEN
    INSERT INTO public.session_logs (schedule_id, lesson_plan, learning_outcome, checkin_latitude, checkin_longitude, geo_verified, session_status, submitted_at)
    VALUES (_schedule_id, _lesson_plan, _learning_outcome, _latitude, _longitude, v_geo_ok, 'COMPLETED', now())
    ON CONFLICT (schedule_id) DO UPDATE
      SET lesson_plan = EXCLUDED.lesson_plan,
          learning_outcome = EXCLUDED.learning_outcome,
          checkin_latitude = EXCLUDED.checkin_latitude,
          checkin_longitude = EXCLUDED.checkin_longitude,
          geo_verified = EXCLUDED.geo_verified,
          session_status = 'COMPLETED',
          submitted_at = now();

    FOR r IN SELECT * FROM jsonb_array_elements(_attendance) LOOP
      INSERT INTO public.attendance_logs (schedule_id, student_id, present, submitted_by, attendance_timestamp)
      VALUES (_schedule_id, (r->>'student_id')::uuid, COALESCE((r->>'present')::boolean, false), auth.uid(), now())
      ON CONFLICT (schedule_id, student_id) DO UPDATE
        SET present = EXCLUDED.present,
            submitted_by = auth.uid(),
            attendance_timestamp = now();
      v_attendance_count := v_attendance_count + 1;
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'attendance_written', v_attendance_count,
    'geo_distance_m', v_geo_distance,
    'geo_ok', v_geo_ok,
    'window_ok', v_window_ok
  );

  INSERT INTO public.pending_sync (client_uuid, trainer_registry_id, schedule_id, kind, payload, client_timestamp, status, conflict_reason, result)
  VALUES (_client_uuid, v_trainer_id, _schedule_id, 'session_batch',
    jsonb_build_object('lesson_plan', _lesson_plan, 'learning_outcome', _learning_outcome, 'attendance', _attendance, 'lat', _latitude, 'lng', _longitude),
    _client_timestamp, v_status, v_reason, v_result);

  RETURN jsonb_build_object('status', v_status, 'conflict_reason', v_reason, 'replayed', false, 'result', v_result);
END;
$function$;