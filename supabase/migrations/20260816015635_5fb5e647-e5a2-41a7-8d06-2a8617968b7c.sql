CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE OR REPLACE FUNCTION public.phone_owner(_phone text)
RETURNS TABLE(kind text, name text, id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'staff'::text, p.full_name, p.id FROM public.profiles p
   WHERE p.phone = _phone
  UNION ALL
  SELECT 'trainer'::text, t.full_name, t.id FROM public.trainer_registry t
   WHERE t.phone = _phone
  UNION ALL
  SELECT 'student'::text, s.full_name, s.id FROM public.students s
   WHERE s.telephone = _phone
$$;

REVOKE ALL ON FUNCTION public.phone_owner(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phone_owner(text) TO service_role;