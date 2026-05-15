
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('MA', 'DH', 'T');
CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE public.entity_active AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE public.level_name AS ENUM ('I', 'II', 'III', 'IV', 'V');
CREATE TYPE public.module_type AS ENUM ('Theory', 'Practical', 'Both');
CREATE TYPE public.venue_type AS ENUM ('Workshop', 'Lab', 'Classroom');
CREATE TYPE public.semester_status AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE public.schedule_status AS ENUM ('DRAFT','PENDING','FEEDBACK_REQUIRED','LIVE','COMPLETED','CANCELLED','ARCHIVED');
CREATE TYPE public.session_status AS ENUM ('LIVE','COMPLETED');
CREATE TYPE public.notification_type AS ENUM ('PUSH','EMAIL','SMS','IN_APP');
CREATE TYPE public.leave_status AS ENUM ('PENDING','APPROVED','REJECTED');

-- =====================================================
-- DEPARTMENTS (no deps)
-- =====================================================
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- PROFILES (linked to auth.users)
-- =====================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  trainer_registry_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- USER ROLES (separate, prevents privilege escalation)
-- =====================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- has_role security definer (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- get current user's department (for DH scoping)
CREATE OR REPLACE FUNCTION public.current_department_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

-- get current user's trainer registry id
CREATE OR REPLACE FUNCTION public.current_trainer_registry_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT trainer_registry_id FROM public.profiles WHERE id = auth.uid();
$$;

-- handle new user trigger -> create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- DEPARTMENT HEADS
-- =====================================================
CREATE TABLE public.department_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- =====================================================
-- TRAINER REGISTRY
-- =====================================================
CREATE TABLE public.trainer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  hidden_staff_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  email text NOT NULL UNIQUE,
  phone text,
  qualifications text[] NOT NULL DEFAULT '{}',
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  status public.entity_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- now add FK on profiles.trainer_registry_id
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_trainer_registry_fk
  FOREIGN KEY (trainer_registry_id) REFERENCES public.trainer_registry(id) ON DELETE SET NULL;

-- =====================================================
-- TRAINER SKILLS
-- =====================================================
CREATE TABLE public.trainer_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_registry_id uuid NOT NULL REFERENCES public.trainer_registry(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  qualification_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- LEVELS
-- =====================================================
CREATE TABLE public.levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name public.level_name NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, department_id)
);

-- =====================================================
-- SECTIONS
-- =====================================================
CREATE TABLE public.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
  name text NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- STUDENTS
-- =====================================================
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  gender text,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  status public.entity_active NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- MODULES
-- =====================================================
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
  type public.module_type NOT NULL DEFAULT 'Both',
  qualifications text[] NOT NULL DEFAULT '{}',
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  total_hours numeric NOT NULL DEFAULT 0,
  total_sessions integer NOT NULL DEFAULT 0,
  status public.entity_active NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- VENUES
-- =====================================================
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type public.venue_type NOT NULL DEFAULT 'Classroom',
  latitude numeric NOT NULL DEFAULT 0,
  longitude numeric NOT NULL DEFAULT 0,
  geo_radius numeric NOT NULL DEFAULT 50,
  capacity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- SEMESTER REGISTRY
-- =====================================================
CREATE TABLE public.semester_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.semester_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- SCHEDULES
-- =====================================================
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semester_registry(id) ON DELETE RESTRICT,
  week_num integer NOT NULL,
  date date NOT NULL,
  day text NOT NULL,
  trainer_name text NOT NULL,
  hidden_staff_id uuid NOT NULL,
  trainer_registry_id uuid NOT NULL REFERENCES public.trainer_registry(id) ON DELETE RESTRICT,
  module_code text NOT NULL,
  module_name text NOT NULL,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE RESTRICT,
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  start_time time NOT NULL,
  end_time time NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  status public.schedule_status NOT NULL DEFAULT 'DRAFT',
  admin_feedback text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- ATTENDANCE LOGS
-- =====================================================
CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  present boolean NOT NULL DEFAULT false,
  attendance_timestamp timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================
-- SESSION LOGS
-- =====================================================
CREATE TABLE public.session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  learning_outcome text,
  lesson_plan text,
  geo_verified boolean NOT NULL DEFAULT false,
  checkin_latitude numeric,
  checkin_longitude numeric,
  session_status public.session_status NOT NULL DEFAULT 'LIVE',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- APPROVAL QUEUE
-- =====================================================
CREATE TABLE public.approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  conflict_trainer boolean NOT NULL DEFAULT false,
  conflict_venue boolean NOT NULL DEFAULT false,
  excessive_load boolean NOT NULL DEFAULT false,
  invalid_qualification boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- ATTENDANCE OVERRIDES
-- =====================================================
CREATE TABLE public.attendance_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid NOT NULL REFERENCES public.attendance_logs(id) ON DELETE CASCADE,
  old_value boolean NOT NULL,
  new_value boolean NOT NULL,
  audit_comment text NOT NULL,
  overridden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  override_timestamp timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- =====================================================
-- AUDIT LOGS
-- =====================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  timestamp timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  device_info text
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'IN_APP',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- LEAVE REQUESTS
-- =====================================================
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_registry_id uuid NOT NULL REFERENCES public.trainer_registry(id) ON DELETE CASCADE,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- GLOBAL CONFIG (single row pattern)
-- =====================================================
CREATE TABLE public.global_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_fence_radius numeric NOT NULL DEFAULT 50,
  attendance_window_minutes integer NOT NULL DEFAULT 15,
  allow_offline_sync boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.global_config (geo_fence_radius, attendance_window_minutes, allow_offline_sync)
VALUES (50, 15, true);

-- =====================================================
-- ENABLE RLS ON EVERYTHING
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'MA'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'MA'));
CREATE POLICY "profiles MA insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'MA') OR id = auth.uid());

-- user_roles: MA full access; users can read own
CREATE POLICY "user_roles MA all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- departments: MA full; everyone read
CREATE POLICY "departments read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments MA write" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- department_heads: MA full; DH read own
CREATE POLICY "dh read all auth" ON public.department_heads FOR SELECT TO authenticated USING (true);
CREATE POLICY "dh MA write" ON public.department_heads FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- trainer_registry: MA full; DH read own dept; T read self
CREATE POLICY "trainer_registry MA all" ON public.trainer_registry FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "trainer_registry DH read" ON public.trainer_registry FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'DH') AND department_id = public.current_department_id());
CREATE POLICY "trainer_registry T self" ON public.trainer_registry FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'T') AND id = public.current_trainer_registry_id());

-- trainer_skills
CREATE POLICY "trainer_skills MA all" ON public.trainer_skills FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "trainer_skills DH read" ON public.trainer_skills FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.trainer_registry tr WHERE tr.id = trainer_registry_id AND tr.department_id = public.current_department_id()
  )
);
CREATE POLICY "trainer_skills T self" ON public.trainer_skills FOR SELECT TO authenticated USING (trainer_registry_id = public.current_trainer_registry_id());

-- levels
CREATE POLICY "levels read" ON public.levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels MA write" ON public.levels FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- sections
CREATE POLICY "sections read" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections MA write" ON public.sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- students
CREATE POLICY "students MA all" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "students DH read" ON public.students FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'DH') AND department_id = public.current_department_id());

-- modules
CREATE POLICY "modules read" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "modules MA write" ON public.modules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- venues
CREATE POLICY "venues read" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "venues MA write" ON public.venues FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- semester_registry
CREATE POLICY "semester read" ON public.semester_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "semester MA write" ON public.semester_registry FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));

-- schedules
CREATE POLICY "schedules MA all" ON public.schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "schedules DH dept" ON public.schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'DH') AND department_id = public.current_department_id())
  WITH CHECK (public.has_role(auth.uid(),'DH') AND department_id = public.current_department_id());
CREATE POLICY "schedules T self" ON public.schedules FOR SELECT TO authenticated USING (trainer_registry_id = public.current_trainer_registry_id());

-- attendance_logs
CREATE POLICY "attendance MA all" ON public.attendance_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "attendance DH dept read" ON public.attendance_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.department_id = public.current_department_id()
  )
);
CREATE POLICY "attendance T own schedule" ON public.attendance_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.trainer_registry_id = public.current_trainer_registry_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.trainer_registry_id = public.current_trainer_registry_id()));

-- session_logs
CREATE POLICY "session_logs MA all" ON public.session_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "session_logs DH read" ON public.session_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.department_id = public.current_department_id()
  )
);
CREATE POLICY "session_logs T own" ON public.session_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.trainer_registry_id = public.current_trainer_registry_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.trainer_registry_id = public.current_trainer_registry_id()));

-- approval_queue
CREATE POLICY "approval_queue MA all" ON public.approval_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "approval_queue DH read" ON public.approval_queue FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND s.department_id = public.current_department_id()
  )
);

-- attendance_overrides
CREATE POLICY "overrides MA all" ON public.attendance_overrides FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "overrides DH dept" ON public.attendance_overrides FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.attendance_logs al JOIN public.schedules s ON s.id=al.schedule_id
    WHERE al.id = attendance_log_id AND s.department_id = public.current_department_id()
  )
) WITH CHECK (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.attendance_logs al JOIN public.schedules s ON s.id=al.schedule_id
    WHERE al.id = attendance_log_id AND s.department_id = public.current_department_id()
  )
);

-- audit_logs: MA only
CREATE POLICY "audit MA all" ON public.audit_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (true);

-- notifications: own only
CREATE POLICY "notifications self" ON public.notifications FOR ALL TO authenticated USING (recipient_id = auth.uid() OR public.has_role(auth.uid(),'MA')) WITH CHECK (recipient_id = auth.uid() OR public.has_role(auth.uid(),'MA'));

-- leave_requests
CREATE POLICY "leave MA all" ON public.leave_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
CREATE POLICY "leave T self" ON public.leave_requests FOR ALL TO authenticated
  USING (trainer_registry_id = public.current_trainer_registry_id())
  WITH CHECK (trainer_registry_id = public.current_trainer_registry_id());
CREATE POLICY "leave DH dept read" ON public.leave_requests FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'DH') AND EXISTS (
    SELECT 1 FROM public.trainer_registry tr WHERE tr.id = trainer_registry_id AND tr.department_id = public.current_department_id()
  )
);

-- global_config
CREATE POLICY "config read" ON public.global_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config MA write" ON public.global_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'MA')) WITH CHECK (public.has_role(auth.uid(),'MA'));
