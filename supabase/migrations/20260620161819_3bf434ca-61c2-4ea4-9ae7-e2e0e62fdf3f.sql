DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedules','semester_registry','approval_queue','notifications','attendance_logs','session_logs','audit_logs']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN others THEN
      NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;