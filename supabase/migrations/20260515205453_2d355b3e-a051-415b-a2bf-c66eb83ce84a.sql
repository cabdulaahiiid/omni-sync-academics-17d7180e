
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['session_logs','attendance_logs','leave_requests'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
