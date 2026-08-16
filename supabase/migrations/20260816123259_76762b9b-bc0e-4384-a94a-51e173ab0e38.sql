ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code text;

UPDATE public.departments d
SET code = sub.c
FROM (
  SELECT id,
         upper(
           CASE
             WHEN array_length(regexp_split_to_array(trim(name), '\s+'), 1) > 1
               THEN substr(regexp_replace(array_to_string(ARRAY(SELECT left(w,1) FROM unnest(regexp_split_to_array(trim(name), '\s+')) w), ''), '[^A-Za-z]', '', 'g'), 1, 4)
             ELSE substr(regexp_replace(trim(name), '[^A-Za-z]', '', 'g'), 1, 3)
           END
         ) AS c
  FROM public.departments
) sub
WHERE d.id = sub.id AND (d.code IS NULL OR d.code = '');

UPDATE public.departments SET code = 'DEP' WHERE code IS NULL OR code = '';

-- de-duplicate codes
WITH ranked AS (
  SELECT id, code, row_number() OVER (PARTITION BY code ORDER BY created_at) AS rn
  FROM public.departments
)
UPDATE public.departments d
SET code = d.code || r.rn::text
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS departments_code_key ON public.departments (upper(code));

-- DH write access, department scoped
CREATE POLICY "students DH write" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id());

CREATE POLICY "students DH update" ON public.students
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  WITH CHECK (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id());

CREATE POLICY "trainer_registry DH write" ON public.trainer_registry
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id());

CREATE POLICY "trainer_registry DH update" ON public.trainer_registry
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id())
  WITH CHECK (public.has_role(auth.uid(),'DH'::app_role) AND department_id = public.current_department_id());

-- Next registration code: ICT-26-0001
CREATE OR REPLACE FUNCTION public.next_entity_code(_department_id uuid, _kind text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_yy text := to_char(now(), 'YY');
  v_prefix text;
  v_max int := 0;
BEGIN
  SELECT COALESCE(NULLIF(code,''), 'DEP') INTO v_code FROM public.departments WHERE id = _department_id;
  IF v_code IS NULL THEN RAISE EXCEPTION 'Unknown department'; END IF;
  v_prefix := upper(v_code) || '-' || v_yy || '-';

  IF _kind = 'trainer' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(right(t.email, 0) || '', '.*', '', 'g'), '')::int), 0) INTO v_max FROM public.trainer_registry t WHERE false;
    SELECT COALESCE(MAX(substr(t.staff_code, length(v_prefix)+1)::int), 0) INTO v_max
      FROM (SELECT NULL::text AS staff_code WHERE false) t;
    SELECT COALESCE(MAX(substring(x FROM '[0-9]+$')::int), 0) INTO v_max
      FROM (
        SELECT tr.full_name AS x FROM public.trainer_registry tr WHERE false
      ) s;
    -- trainers keep their code in trainer_registry.staff_code if present, else derive from audit-free sequence
    SELECT COALESCE(MAX(substring(a.entity_id FROM '[0-9]+$')::int), 0) INTO v_max
      FROM public.audit_logs a
     WHERE a.action_type = 'TRAINER_CODE_ISSUED' AND a.entity_id LIKE v_prefix || '%';
  ELSE
    SELECT COALESCE(MAX(substring(s.registration_number FROM '[0-9]+$')::int), 0) INTO v_max
      FROM public.students s
     WHERE s.registration_number LIKE v_prefix || '%';
  END IF;

  RETURN v_prefix || lpad((v_max + 1)::text, 4, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_entity_code(uuid, text) TO authenticated;