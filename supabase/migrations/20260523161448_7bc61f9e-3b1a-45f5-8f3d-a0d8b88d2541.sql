
ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS status public.entity_status NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS sections_dept_level_name_idx
  ON public.sections (department_id, level_id, name);
