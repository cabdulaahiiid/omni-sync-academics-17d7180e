
-- 1) Privilege escalation prevention on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'MA'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.trainer_registry_id IS DISTINCT FROM OLD.trainer_registry_id
     OR NEW.department_id     IS DISTINCT FROM OLD.department_id
     OR NEW.bypass_geofence   IS DISTINCT FROM OLD.bypass_geofence
     OR NEW.active            IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Only Master Admins can change trainer_registry_id, department_id, bypass_geofence, or active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2) Restrict department_heads read access
DROP POLICY IF EXISTS "dh read all auth" ON public.department_heads;
CREATE POLICY "dh read MA or self" ON public.department_heads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'MA'::app_role) OR user_id = auth.uid());

-- 3) Tighten audit_logs ALL policy (was WITH CHECK true)
DROP POLICY IF EXISTS "audit MA all" ON public.audit_logs;
CREATE POLICY "audit MA all" ON public.audit_logs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'MA'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'MA'::app_role));

-- 4) Revoke execute from anon on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.reset_academic_data() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wipe_entire_system() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_resubmit_week(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_resubmit_semester(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_submit_semester_per_week(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_delete_draft_session(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_swap_trainer(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_override_attendance(uuid, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dh_reply_feedback(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ma_decide_week(uuid, integer, approval_decision, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ma_reject_semester_with_feedback(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ma_split_semester_to_weeks(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.decide_approval(uuid, approval_decision, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_for_approval(approval_type, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trainer_checkin(uuid, numeric, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trainer_end_session(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_session_mode(uuid, session_mode) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.submit_session_batch(uuid, uuid, timestamptz, text, text, numeric, numeric, jsonb) FROM anon, public;
