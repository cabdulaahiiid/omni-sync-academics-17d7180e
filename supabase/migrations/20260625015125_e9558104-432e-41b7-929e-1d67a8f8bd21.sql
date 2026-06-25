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
  -- Attendance window = last 10 minutes of the session (+ 5 min grace after end).
  IF now() < v_session_end - interval '10 minutes' OR now() > v_session_end + interval '5 minutes' THEN
    RAISE EXCEPTION 'Outside attendance window (last 10 minutes of session)';
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