
ALTER TABLE public.approval_queue ALTER COLUMN schedule_id DROP NOT NULL;

ALTER TABLE public.approval_queue DROP CONSTRAINT IF EXISTS approval_queue_type_schedule_chk;
ALTER TABLE public.approval_queue
  ADD CONSTRAINT approval_queue_type_schedule_chk
  CHECK (
    (type = 'session' AND schedule_id IS NOT NULL)
    OR (type = 'semester')
  );

DROP POLICY IF EXISTS "approval_queue DH read" ON public.approval_queue;
CREATE POLICY "approval_queue DH read" ON public.approval_queue
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'DH'::app_role)
    AND (
      (type = 'session' AND EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.id = approval_queue.schedule_id
          AND s.department_id = public.current_department_id()
      ))
      OR
      (type = 'semester' AND EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.semester_id = approval_queue.target_id
          AND s.department_id = public.current_department_id()
        LIMIT 1
      ))
    )
  );
