DO $$
DECLARE a uuid;
BEGIN
  ALTER TABLE public.schedules DISABLE TRIGGER trg_enforce_schedule_transition;
  UPDATE public.schedules s SET status='ENDED'
   FROM public.semester_registry sr
   WHERE sr.id=s.semester_id AND sr.name='Demo Academic Year 2026' AND s.status='COMPLETED';
  ALTER TABLE public.schedules ENABLE TRIGGER trg_enforce_schedule_transition;

  -- leave 6 ended sessions without a closing log so the compliance report shows gaps
  DELETE FROM public.session_logs sl
   WHERE sl.schedule_id IN (
     SELECT s.id FROM public.schedules s
     JOIN public.semester_registry sr ON sr.id=s.semester_id
     WHERE sr.name='Demo Academic Year 2026' AND s.status='ENDED'
     ORDER BY s.date DESC LIMIT 6);

  SELECT id INTO a FROM public.profiles ORDER BY created_at LIMIT 1;
  IF a IS NOT NULL THEN
    INSERT INTO public.audit_logs(actor_id,action_type,entity_type,after_state,timestamp)
    SELECT a, al.action_type, al.entity_type, al.after_state, al.timestamp
    FROM public.audit_logs al
    WHERE al.actor_id IS NULL AND al.after_state ? 'note';
  END IF;
END $$;