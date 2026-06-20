
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_user_as_ma();

INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1), ''), u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

ALTER TABLE public.profiles DISABLE TRIGGER USER;

DO $$
DECLARE
  v_user RECORD;
  v_dept uuid;
  v_tr_id uuid;
BEGIN
  FOR v_user IN
    SELECT p.id AS profile_id, p.email, p.full_name, p.department_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'T'::app_role
     WHERE p.trainer_registry_id IS NULL
  LOOP
    v_dept := COALESCE(v_user.department_id, (SELECT id FROM public.departments ORDER BY name LIMIT 1));
    IF v_dept IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.trainer_registry (hidden_staff_id, full_name, email, qualifications, department_id, sessions_target)
    VALUES (v_user.profile_id, COALESCE(NULLIF(v_user.full_name,''), split_part(v_user.email,'@',1)), v_user.email, ARRAY[]::text[], v_dept, 0)
    RETURNING id INTO v_tr_id;

    UPDATE public.profiles
       SET trainer_registry_id = v_tr_id,
           department_id = COALESCE(department_id, v_dept)
     WHERE id = v_user.profile_id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.link_trainer_login(_profile_id uuid, _department_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr uuid;
  v_dept uuid;
  v_email text;
  v_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT trainer_registry_id, email, full_name, department_id
    INTO v_tr, v_email, v_name, v_dept
    FROM public.profiles WHERE id = _profile_id;
  IF v_tr IS NOT NULL THEN RETURN v_tr; END IF;
  v_dept := COALESCE(_department_id, v_dept, (SELECT id FROM public.departments ORDER BY name LIMIT 1));
  IF v_dept IS NULL THEN RAISE EXCEPTION 'No department available'; END IF;
  INSERT INTO public.trainer_registry (hidden_staff_id, full_name, email, qualifications, department_id, sessions_target)
  VALUES (_profile_id, COALESCE(NULLIF(v_name,''), split_part(v_email,'@',1)), v_email, ARRAY[]::text[], v_dept, 0)
  RETURNING id INTO v_tr;
  ALTER TABLE public.profiles DISABLE TRIGGER USER;
  UPDATE public.profiles
     SET trainer_registry_id = v_tr,
         department_id = COALESCE(department_id, v_dept)
   WHERE id = _profile_id;
  ALTER TABLE public.profiles ENABLE TRIGGER USER;
  RETURN v_tr;
END $$;
