
-- 1) Revoke EXECUTE from anon/public on SECURITY DEFINER admin functions
REVOKE EXECUTE ON FUNCTION public.admin_set_dh_department(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_trainer_departments(uuid, uuid[], uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_roles(uuid, app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.link_trainer_login(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ma_delete_schedule(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sync_trainer_primary_department() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_set_dh_department(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_trainer_departments(uuid, uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_roles(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_trainer_login(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ma_delete_schedule(uuid, text) TO authenticated;

-- 2) Storage: scope pending uploads to the uploader's own folder
DROP POLICY IF EXISTS "avatars pending insert" ON storage.objects;
CREATE POLICY "avatars pending insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND split_part(name, '/', 1) = 'pending'
  AND split_part(name, '/', 2) = auth.uid()::text
);

-- 3) Explicit INSERT policy for trainers on approval_queue (own pending submissions)
CREATE POLICY "Users can submit their own pending approvals"
ON public.approval_queue FOR INSERT TO authenticated
WITH CHECK (submitted_by = auth.uid() AND decision = 'pending');
