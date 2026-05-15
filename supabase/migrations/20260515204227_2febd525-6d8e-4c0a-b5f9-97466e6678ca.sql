
-- pending_sync table
CREATE TABLE IF NOT EXISTS public.pending_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid uuid NOT NULL UNIQUE,
  trainer_registry_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('session_batch')),
  payload jsonb NOT NULL,
  client_timestamp timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','conflict','rejected')),
  conflict_reason text,
  result jsonb
);

ALTER TABLE public.pending_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_sync MA all" ON public.pending_sync
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));

CREATE POLICY "pending_sync T self" ON public.pending_sync
  FOR ALL TO authenticated
  USING (trainer_registry_id = current_trainer_registry_id())
  WITH CHECK (trainer_registry_id = current_trainer_registry_id());

CREATE POLICY "pending_sync DH dept" ON public.pending_sync
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'DH'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = pending_sync.schedule_id
        AND s.department_id = current_department_id()
    )
  );

-- Idempotency / dedupe indexes
CREATE UNIQUE INDEX IF NOT EXISTS attendance_logs_schedule_student_uniq
  ON public.attendance_logs(schedule_id, student_id);

CREATE UNIQUE INDEX IF NOT EXISTS session_logs_schedule_uniq
  ON public.session_logs(schedule_id);

-- Atomic batch submit RPC
CREATE OR REPLACE FUNCTION public.submit_session_batch(
  _client_uuid uuid,
  _schedule_id uuid,
  _client_timestamp timestamptz,
  _lesson_plan text,
  _learning_outcome text,
  _latitude numeric,
  _longitude numeric,
  _attendance jsonb -- [{student_id, present}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  r jsonb;
BEGIN
  -- Resolve trainer registry
  SELECT trainer_registry_id INTO v_trainer_id FROM public.profiles WHERE id = auth.uid();
  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Not a trainer';
  END IF;

  -- Idempotency: replay if same client_uuid
  SELECT * INTO v_existing FROM public.pending_sync WHERE client_uuid = _client_uuid;
  IF FOUND THEN
    RETURN jsonb_build_object('status', v_existing.status, 'conflict_reason', v_existing.conflict_reason, 'replayed', true, 'result', v_existing.result);
  END IF;

  -- Load schedule & ensure ownership
  SELECT * INTO v_schedule FROM public.schedules WHERE id = _schedule_id;
  IF NOT FOUND OR v_schedule.trainer_registry_id <> v_trainer_id THEN
    RAISE EXCEPTION 'Unauthorized for this schedule';
  END IF;

  -- Load venue + global window
  SELECT * INTO v_venue FROM public.venues WHERE id = v_schedule.venue_id;
  SELECT attendance_window_minutes INTO v_window FROM public.global_config LIMIT 1;
  v_window := COALESCE(v_window, 15);

  -- Geo-fence (haversine in meters; small approximation good for <5km)
  IF _latitude IS NOT NULL AND _longitude IS NOT NULL AND v_venue.latitude IS NOT NULL THEN
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

  -- Attendance window
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
    -- Upsert session log
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

    -- Upsert attendance per student
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
$$;

-- Realtime: enable for tables we live-monitor
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
