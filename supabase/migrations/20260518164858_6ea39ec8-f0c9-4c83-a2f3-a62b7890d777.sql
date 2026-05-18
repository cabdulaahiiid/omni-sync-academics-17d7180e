-- Unique constraint so ON CONFLICT works
ALTER TABLE public.levels ADD CONSTRAINT levels_dept_name_unique UNIQUE (department_id, name);

-- Auto-seed function
CREATE OR REPLACE FUNCTION public.seed_department_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.levels (department_id, name)
  SELECT NEW.id, l::level_name FROM unnest(ARRAY['I','II','III','IV','V']) l
  ON CONFLICT (department_id, name) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_levels ON public.departments;
CREATE TRIGGER trg_seed_levels
  AFTER INSERT ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.seed_department_levels();

-- Backfill existing departments
INSERT INTO public.levels (department_id, name)
SELECT d.id, l::level_name
FROM public.departments d
CROSS JOIN unnest(ARRAY['I','II','III','IV','V']) l
ON CONFLICT (department_id, name) DO NOTHING;