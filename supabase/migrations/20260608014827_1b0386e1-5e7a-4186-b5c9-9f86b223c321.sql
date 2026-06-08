-- Realtime for notifications (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- DH-only delete of a DRAFT session in their own department
CREATE OR REPLACE FUNCTION public.dh_delete_draft_session(_schedule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_dept uuid; v_status schedule_status; v_sem uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN
    RAISE EXCEPTION 'DH only';
  END IF;
  SELECT department_id, status, semester_id INTO v_dept, v_status, v_sem
    FROM public.schedules WHERE id = _schedule_id;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;
  IF v_status <> 'DRAFT'::schedule_status THEN
    RAISE EXCEPTION 'Only DRAFT sessions can be deleted (current: %)', v_status;
  END IF;

  -- Clear any pending approval rows pointing at this schedule
  DELETE FROM public.approval_queue
   WHERE type='session' AND schedule_id = _schedule_id AND decision='pending';

  DELETE FROM public.schedules WHERE id = _schedule_id;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'DELETE_DRAFT_SESSION', 'schedules', _schedule_id::text,
          jsonb_build_object('semester_id', v_sem));
END
$$;