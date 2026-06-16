
-- 1) Add avatar_path to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;

-- 2) Storage RLS for avatars bucket
-- Read: any authenticated user
CREATE POLICY "avatars read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Self insert: path prefix must be auth.uid()
CREATE POLICY "avatars self insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1) = auth.uid()::text)
  );

CREATE POLICY "avatars self update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1) = auth.uid()::text)
  );

CREATE POLICY "avatars self delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (split_part(name, '/', 1) = auth.uid()::text)
  );

-- MA can manage any avatar (including pending/ prefix used for new user registrations)
CREATE POLICY "avatars MA all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'MA'::app_role));

-- Allow any authenticated user to upload to pending/ (used during new-user registration flow before the user exists)
CREATE POLICY "avatars pending insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = 'pending'
  );
