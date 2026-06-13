
CREATE OR REPLACE FUNCTION public.wipe_entire_system()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  IF NOT public.has_role(v_actor, 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

  -- Truncate academic + operational data first (FK-safe via CASCADE)
  TRUNCATE TABLE
    public.attendance_overrides,
    public.attendance_logs,
    public.session_logs,
    public.pending_sync,
    public.schedule_feedback_messages,
    public.schedule_feedback_threads,
    public.approval_queue,
    public.schedules,
    public.semester_registry,
    public.students,
    public.trainer_skills,
    public.modules,
    public.leave_requests,
    public.notifications,
    public.sections,
    public.levels,
    public.venues,
    public.trainer_registry,
    public.department_heads,
    public.audit_logs
  RESTART IDENTITY CASCADE;

  -- Remove all user_roles except the calling MA
  DELETE FROM public.user_roles WHERE user_id <> v_actor;

  -- Remove all profiles except the calling MA
  DELETE FROM public.profiles WHERE id <> v_actor;

  -- Wipe departments after department_heads is gone
  DELETE FROM public.departments;

  -- Write final audit row (audit_logs was truncated above)
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (v_actor, 'WIPE_ENTIRE_SYSTEM', 'system', 'system',
          jsonb_build_object('actor_email', v_email, 'at', now()));

  RETURN jsonb_build_object('ok', true, 'kept_user', v_actor);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_academic_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;

  TRUNCATE TABLE
    public.attendance_overrides,
    public.attendance_logs,
    public.session_logs,
    public.pending_sync,
    public.schedule_feedback_messages,
    public.schedule_feedback_threads,
    public.approval_queue,
    public.schedules,
    public.semester_registry,
    public.students,
    public.trainer_skills,
    public.modules,
    public.leave_requests,
    public.notifications,
    public.trainer_registry
  RESTART IDENTITY CASCADE;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (v_actor, 'RESET_ACADEMIC_DATA', 'system', 'academic',
          jsonb_build_object('at', now()));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.wipe_entire_system() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_academic_data() TO authenticated;
