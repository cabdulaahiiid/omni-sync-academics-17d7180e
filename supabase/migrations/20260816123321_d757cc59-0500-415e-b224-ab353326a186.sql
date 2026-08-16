ALTER TABLE public.trainer_registry ADD COLUMN IF NOT EXISTS staff_code text;

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
    SELECT COALESCE(MAX(substring(tr.staff_code FROM '[0-9]+$')::int), 0) INTO v_max
      FROM public.trainer_registry tr
     WHERE tr.staff_code LIKE v_prefix || '%';
  ELSE
    SELECT COALESCE(MAX(substring(s.registration_number FROM '[0-9]+$')::int), 0) INTO v_max
      FROM public.students s
     WHERE s.registration_number LIKE v_prefix || '%';
  END IF;

  RETURN v_prefix || lpad((v_max + 1)::text, 4, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_entity_code(uuid, text) TO authenticated;