
-- 1) Profiles: bypass_geofence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bypass_geofence boolean NOT NULL DEFAULT false;

-- 2) Global config: campus center + radius
ALTER TABLE public.global_config
  ADD COLUMN IF NOT EXISTS campus_lat numeric,
  ADD COLUMN IF NOT EXISTS campus_lng numeric,
  ADD COLUMN IF NOT EXISTS campus_radius_m numeric NOT NULL DEFAULT 150;

-- 3) Feedback threads
CREATE TABLE IF NOT EXISTS public.schedule_feedback_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semester_registry(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES public.profiles(id),
  dh_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (semester_id)
);
ALTER TABLE public.schedule_feedback_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb_threads MA all" ON public.schedule_feedback_threads;
CREATE POLICY "fb_threads MA all" ON public.schedule_feedback_threads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'MA'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'MA'::app_role));

DROP POLICY IF EXISTS "fb_threads DH dept" ON public.schedule_feedback_threads;
CREATE POLICY "fb_threads DH dept" ON public.schedule_feedback_threads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id());

-- 4) Feedback messages
CREATE TABLE IF NOT EXISTS public.schedule_feedback_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.schedule_feedback_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_feedback_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb_msgs MA all" ON public.schedule_feedback_messages;
CREATE POLICY "fb_msgs MA all" ON public.schedule_feedback_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'MA'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'MA'::app_role));

DROP POLICY IF EXISTS "fb_msgs DH dept read" ON public.schedule_feedback_messages;
CREATE POLICY "fb_msgs DH dept read" ON public.schedule_feedback_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'DH'::app_role) AND EXISTS (
      SELECT 1 FROM public.schedule_feedback_threads t
      WHERE t.id = schedule_feedback_messages.thread_id
        AND t.department_id = public.current_department_id()
    )
  );

DROP POLICY IF EXISTS "fb_msgs DH dept write" ON public.schedule_feedback_messages;
CREATE POLICY "fb_msgs DH dept write" ON public.schedule_feedback_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'DH'::app_role) AND EXISTS (
      SELECT 1 FROM public.schedule_feedback_threads t
      WHERE t.id = schedule_feedback_messages.thread_id
        AND t.department_id = public.current_department_id()
    ) AND sender_id = auth.uid()
  );

-- 5) RPC: MA reject with feedback
CREATE OR REPLACE FUNCTION public.ma_reject_semester_with_feedback(_semester_id uuid, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread uuid;
  v_dept uuid;
  v_dh uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN
    RAISE EXCEPTION 'Feedback message required';
  END IF;

  -- Find dept from any schedule under this semester
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  SELECT user_id INTO v_dh FROM public.department_heads WHERE department_id = v_dept LIMIT 1;

  INSERT INTO public.schedule_feedback_threads(semester_id, department_id, admin_id, dh_id)
  VALUES (_semester_id, v_dept, auth.uid(), v_dh)
  ON CONFLICT (semester_id) DO UPDATE SET admin_id = EXCLUDED.admin_id, dh_id = COALESCE(public.schedule_feedback_threads.dh_id, EXCLUDED.dh_id)
  RETURNING id INTO v_thread;

  INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
  VALUES (v_thread, auth.uid(), _message);

  UPDATE public.semester_registry SET status = 'DRAFT' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'DRAFT' WHERE semester_id = _semester_id AND status = 'PENDING_MA';

  -- Notify DH
  IF v_dh IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_dh, 'Schedule rejected', 'Admin returned the semester for changes. Open the chat to review.');
  END IF;

  RETURN v_thread;
END;
$$;

-- 6) RPC: DH reply
CREATE OR REPLACE FUNCTION public.dh_reply_feedback(_thread_id uuid, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid; v_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) AND NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;
  IF _message IS NULL OR length(trim(_message))=0 THEN RAISE EXCEPTION 'Message required'; END IF;

  SELECT department_id INTO v_dept FROM public.schedule_feedback_threads WHERE id = _thread_id;
  IF public.has_role(auth.uid(),'DH'::app_role) AND v_dept <> public.current_department_id() THEN
    RAISE EXCEPTION 'Out of department';
  END IF;

  INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
  VALUES (_thread_id, auth.uid(), _message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 7) RPC: DH resubmit semester
CREATE OR REPLACE FUNCTION public.dh_resubmit_semester(_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  UPDATE public.semester_registry SET status = 'PENDING_MA' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'PENDING_MA' WHERE semester_id = _semester_id AND status = 'DRAFT';

  INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
  SELECT 'semester'::approval_type, _semester_id, NULL, auth.uid(), 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_queue WHERE target_id = _semester_id AND decision = 'pending'
  );
END;
$$;

-- 8) Realtime
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='schedule_feedback_messages';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_feedback_messages; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='schedule_feedback_threads';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_feedback_threads; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='semester_registry';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.semester_registry; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
