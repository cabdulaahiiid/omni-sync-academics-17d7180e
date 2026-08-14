ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_guardian_name text,
  ADD COLUMN IF NOT EXISTS parent_guardian_telephone text,
  ADD COLUMN IF NOT EXISTS parent_guardian_relationship text;