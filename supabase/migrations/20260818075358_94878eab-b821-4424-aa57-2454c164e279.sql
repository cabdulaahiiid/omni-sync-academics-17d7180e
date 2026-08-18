-- 1. New roles for the cooperative training domain
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'PD';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'CO';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'VT';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'EM';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'TR';

-- 2. Optional link between a login and a student (trainee) record
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_student_id_uidx
  ON public.profiles(student_id) WHERE student_id IS NOT NULL;

-- 3. Configurable business-rule settings (single row)
CREATE TABLE IF NOT EXISTS public.ct_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theory_threshold_percent numeric NOT NULL DEFAULT 80,
  max_daily_logbook_hours numeric NOT NULL DEFAULT 12,
  remedial_hours_per_failed_uc integer NOT NULL DEFAULT 20,
  remedial_hours_per_red_competency integer NOT NULL DEFAULT 10,
  max_red_competencies_for_assessment integer NOT NULL DEFAULT 1,
  absence_days_threshold integer NOT NULL DEFAULT 3,
  missing_logbook_counts_as_absence boolean NOT NULL DEFAULT false,
  calculation_version integer NOT NULL DEFAULT 1,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ct_settings TO authenticated;
GRANT ALL ON public.ct_settings TO service_role;
ALTER TABLE public.ct_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ct_settings readable by authenticated"
  ON public.ct_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ct_settings managed by MA"
  ON public.ct_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'MA'::app_role));
GRANT INSERT, UPDATE ON public.ct_settings TO authenticated;

CREATE TRIGGER ct_settings_set_updated_at
  BEFORE UPDATE ON public.ct_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();

INSERT INTO public.ct_settings (id) VALUES (gen_random_uuid());