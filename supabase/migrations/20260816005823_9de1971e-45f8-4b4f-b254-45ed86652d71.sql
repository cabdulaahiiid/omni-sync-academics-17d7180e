ALTER TABLE public.students ADD COLUMN IF NOT EXISTS telephone text;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS telephone text;

CREATE UNIQUE INDEX IF NOT EXISTS students_telephone_unique
  ON public.students (telephone)
  WHERE telephone IS NOT NULL AND telephone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS trainer_registry_phone_unique
  ON public.trainer_registry (phone)
  WHERE phone IS NOT NULL AND phone <> '';