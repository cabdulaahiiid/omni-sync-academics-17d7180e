CREATE TABLE public.module_practical_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name text NOT NULL,
  allocated_hours numeric(6,2) NOT NULL DEFAULT 0,
  venue_hint text,
  sequence integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_practical_sessions TO authenticated;
GRANT ALL ON public.module_practical_sessions TO service_role;
ALTER TABLE public.module_practical_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read module practical sessions"
  ON public.module_practical_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage module practical sessions"
  ON public.module_practical_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA')) WITH CHECK (public.has_role(auth.uid(), 'MA'));

CREATE TABLE public.module_practical_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.module_practical_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  competency_code text,
  description text,
  sequence integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_practical_tasks TO authenticated;
GRANT ALL ON public.module_practical_tasks TO service_role;
ALTER TABLE public.module_practical_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read module practical tasks"
  ON public.module_practical_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage module practical tasks"
  ON public.module_practical_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA')) WITH CHECK (public.has_role(auth.uid(), 'MA'));

CREATE TABLE public.schedule_plan_practical_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.schedule_plans(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name text NOT NULL,
  allocated_hours numeric(6,2) NOT NULL DEFAULT 0,
  venue_hint text,
  sequence integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_plan_practical_sessions TO authenticated;
GRANT ALL ON public.schedule_plan_practical_sessions TO service_role;
ALTER TABLE public.schedule_plan_practical_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read plan practical sessions"
  ON public.schedule_plan_practical_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and owning department heads manage plan practical sessions"
  ON public.schedule_plan_practical_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA') OR department_id = public.current_department_id())
  WITH CHECK (public.has_role(auth.uid(), 'MA') OR department_id = public.current_department_id());

CREATE TABLE public.schedule_plan_practical_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.schedule_plan_practical_sessions(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title text NOT NULL,
  competency_code text,
  description text,
  sequence integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_plan_practical_tasks TO authenticated;
GRANT ALL ON public.schedule_plan_practical_tasks TO service_role;
ALTER TABLE public.schedule_plan_practical_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read plan practical tasks"
  ON public.schedule_plan_practical_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and owning department heads manage plan practical tasks"
  ON public.schedule_plan_practical_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'MA') OR department_id = public.current_department_id())
  WITH CHECK (public.has_role(auth.uid(), 'MA') OR department_id = public.current_department_id());

CREATE INDEX idx_mps_module ON public.module_practical_sessions(module_id, sequence);
CREATE INDEX idx_mpt_session ON public.module_practical_tasks(session_id, sequence);
CREATE INDEX idx_spps_plan ON public.schedule_plan_practical_sessions(plan_id, sequence);
CREATE INDEX idx_sppt_session ON public.schedule_plan_practical_tasks(session_id, sequence);

CREATE TRIGGER set_mps_updated_at BEFORE UPDATE ON public.module_practical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();
CREATE TRIGGER set_mpt_updated_at BEFORE UPDATE ON public.module_practical_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();
CREATE TRIGGER set_spps_updated_at BEFORE UPDATE ON public.schedule_plan_practical_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();
CREATE TRIGGER set_sppt_updated_at BEFORE UPDATE ON public.schedule_plan_practical_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts();