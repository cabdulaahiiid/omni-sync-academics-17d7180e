DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'schedules','approval_queue','attendance_logs','session_logs',
    'attendance_overrides','students','trainer_registry','modules','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;