-- TVET ERP — full public schema DDL (extracted from live database)
-- Apply as a single migration in a fresh Lovable Cloud project.


-- ============ 1. ENUM TYPES ============

CREATE TYPE public.app_role AS ENUM ('MA', 'DH', 'T');
CREATE TYPE public.approval_decision AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.approval_type AS ENUM ('semester', 'session');
CREATE TYPE public.entity_active AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE public.entity_status AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE public.leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.level_name AS ENUM ('I', 'II', 'III', 'IV', 'V');
CREATE TYPE public.module_type AS ENUM ('Theory', 'Practical', 'Both');
CREATE TYPE public.notification_type AS ENUM ('PUSH', 'EMAIL', 'SMS', 'IN_APP');
CREATE TYPE public.schedule_status AS ENUM ('DRAFT', 'PENDING', 'FEEDBACK_REQUIRED', 'LIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED', 'PENDING_MA', 'ACTIVE', 'ENDED');
CREATE TYPE public.semester_status AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED', 'DRAFT', 'PENDING_MA', 'LIVE', 'ENDED');
CREATE TYPE public.session_mode AS ENUM ('Theory', 'Practical', 'Both');
CREATE TYPE public.session_status AS ENUM ('LIVE', 'COMPLETED');
CREATE TYPE public.venue_type AS ENUM ('Workshop', 'Lab', 'Classroom');


-- ============ 2. TABLES ============

CREATE TABLE public.approval_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid,
  conflict_trainer boolean DEFAULT false NOT NULL,
  conflict_venue boolean DEFAULT false NOT NULL,
  excessive_load boolean DEFAULT false NOT NULL,
  invalid_qualification boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  type approval_type DEFAULT 'session'::approval_type NOT NULL,
  target_id uuid,
  submitted_by uuid,
  decision approval_decision DEFAULT 'pending'::approval_decision NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  comment text,
  CONSTRAINT approval_queue_pkey PRIMARY KEY (id),
  CONSTRAINT approval_queue_type_schedule_chk CHECK ((((type = 'session'::approval_type) AND (schedule_id IS NOT NULL)) OR (type = 'semester'::approval_type)))
);
CREATE TABLE public.attendance_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL,
  student_id uuid NOT NULL,
  present boolean DEFAULT false NOT NULL,
  attendance_timestamp timestamp with time zone DEFAULT now() NOT NULL,
  submitted_by uuid,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  attendance_log_id uuid NOT NULL,
  old_value boolean NOT NULL,
  new_value boolean NOT NULL,
  audit_comment text NOT NULL,
  overridden_by uuid,
  override_timestamp timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  CONSTRAINT attendance_overrides_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  ip_address text,
  device_info text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.auth_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  kind text NOT NULL,
  user_id uuid,
  duration_ms integer,
  attempts integer,
  ok boolean,
  reason text,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT auth_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.department_heads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT department_heads_pkey PRIMARY KEY (id),
  CONSTRAINT department_heads_user_id_department_id_key UNIQUE (user_id, department_id)
);
CREATE TABLE public.departments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  status entity_status DEFAULT 'ACTIVE'::entity_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  telephone text,
  code text,
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_name_key UNIQUE (name)
);
CREATE TABLE public.external_contacts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  role_title text,
  department_id uuid,
  notes text,
  active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT external_contacts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.global_config (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  geo_fence_radius numeric DEFAULT 50 NOT NULL,
  attendance_window_minutes integer DEFAULT 15 NOT NULL,
  allow_offline_sync boolean DEFAULT true NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  campus_lat numeric,
  campus_lng numeric,
  campus_radius_m numeric DEFAULT 150 NOT NULL,
  geofence_enabled boolean DEFAULT true NOT NULL,
  CONSTRAINT global_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leave_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trainer_registry_id uuid NOT NULL,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status leave_status DEFAULT 'PENDING'::leave_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.levels (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name level_name NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  display_name text,
  status entity_status DEFAULT 'ACTIVE'::entity_status NOT NULL,
  CONSTRAINT levels_pkey PRIMARY KEY (id),
  CONSTRAINT levels_dept_name_unique UNIQUE (department_id, name),
  CONSTRAINT levels_name_department_id_key UNIQUE (name, department_id)
);
CREATE TABLE public.modules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  level_id uuid NOT NULL,
  type module_type DEFAULT 'Both'::module_type NOT NULL,
  qualifications text[] DEFAULT '{}'::text[] NOT NULL,
  department_id uuid NOT NULL,
  total_hours numeric DEFAULT 0 NOT NULL,
  total_sessions integer DEFAULT 0 NOT NULL,
  status entity_active DEFAULT 'ACTIVE'::entity_active NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_code_key UNIQUE (code)
);
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  recipient_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  type notification_type DEFAULT 'IN_APP'::notification_type NOT NULL,
  read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pending_sync (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_uuid uuid NOT NULL,
  trainer_registry_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  client_timestamp timestamp with time zone NOT NULL,
  server_received_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'applied'::text NOT NULL,
  conflict_reason text,
  result jsonb,
  CONSTRAINT pending_sync_pkey PRIMARY KEY (id),
  CONSTRAINT pending_sync_client_uuid_key UNIQUE (client_uuid),
  CONSTRAINT pending_sync_kind_check CHECK ((kind = 'session_batch'::text)),
  CONSTRAINT pending_sync_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'conflict'::text, 'rejected'::text])))
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text DEFAULT ''::text NOT NULL,
  email text NOT NULL,
  department_id uuid,
  trainer_registry_id uuid,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  bypass_geofence boolean DEFAULT false NOT NULL,
  avatar_path text,
  phone text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_feedback_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  thread_id uuid NOT NULL,
  sender_id uuid,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT schedule_feedback_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_feedback_threads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  semester_id uuid NOT NULL,
  department_id uuid,
  admin_id uuid,
  dh_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  week_num integer,
  CONSTRAINT schedule_feedback_threads_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  semester_id uuid NOT NULL,
  department_id uuid NOT NULL,
  level_id uuid NOT NULL,
  module_id uuid NOT NULL,
  module_code text NOT NULL,
  module_name text NOT NULL,
  section_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  trainer_registry_id uuid NOT NULL,
  delivery text DEFAULT 'Theory'::text NOT NULL,
  theory_days text[] DEFAULT '{}'::text[] NOT NULL,
  practical_days text[] DEFAULT '{}'::text[] NOT NULL,
  sessions_per_week integer DEFAULT 1 NOT NULL,
  session_minutes integer NOT NULL,
  module_total_minutes integer NOT NULL,
  start_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_date date,
  total_sessions integer DEFAULT 0 NOT NULL,
  total_minutes integer DEFAULT 0 NOT NULL,
  weeks integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT schedule_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  semester_id uuid NOT NULL,
  week_num integer NOT NULL,
  date date NOT NULL,
  day text NOT NULL,
  trainer_name text NOT NULL,
  hidden_staff_id uuid NOT NULL,
  trainer_registry_id uuid NOT NULL,
  module_code text NOT NULL,
  module_name text NOT NULL,
  level_id uuid NOT NULL,
  section_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  department_id uuid NOT NULL,
  status schedule_status DEFAULT 'DRAFT'::schedule_status NOT NULL,
  admin_feedback text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  mode session_mode,
  checkin_at timestamp with time zone,
  attendance_locked_at timestamp with time zone,
  ended_at timestamp with time zone,
  is_published boolean DEFAULT false NOT NULL,
  published_at timestamp with time zone,
  published_by uuid,
  plan_id uuid,
  session_number integer,
  CONSTRAINT schedules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  level_id uuid NOT NULL,
  name text NOT NULL,
  department_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.semester_registry (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status semester_status DEFAULT 'ACTIVE'::semester_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone,
  source_file_url text,
  uploaded_by uuid,
  distribution_status text DEFAULT 'DRAFT'::text NOT NULL,
  CONSTRAINT semester_registry_pkey PRIMARY KEY (id),
  CONSTRAINT semester_registry_distribution_status_check CHECK ((distribution_status = ANY (ARRAY['DRAFT'::text, 'PENDING_MA'::text, 'FEEDBACK_ACTIVE'::text, 'PUBLISHED'::text])))
);
CREATE TABLE public.session_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id uuid NOT NULL,
  learning_outcome text,
  lesson_plan text,
  geo_verified boolean DEFAULT false NOT NULL,
  checkin_latitude numeric,
  checkin_longitude numeric,
  session_status session_status DEFAULT 'LIVE'::session_status NOT NULL,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT session_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_campaigns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sender_id uuid,
  sender_name text,
  message text NOT NULL,
  groups text[] DEFAULT '{}'::text[] NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  total_recipients integer DEFAULT 0 NOT NULL,
  sent_count integer DEFAULT 0 NOT NULL,
  failed_count integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'PENDING'::text NOT NULL,
  error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  scheduled_at timestamp with time zone,
  environment text,
  claimed_at timestamp with time zone,
  CONSTRAINT sms_campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_recipients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  contact_name text,
  phone text NOT NULL,
  source_group text,
  status text DEFAULT 'PENDING'::text NOT NULL,
  provider_message_id text,
  error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sms_recipients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_scheduled_recipients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  campaign_id uuid NOT NULL,
  contact_name text,
  phone text NOT NULL,
  source_group text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sms_scheduled_recipients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sms_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  api_key text,
  sender_id text,
  environment text DEFAULT 'production'::text NOT NULL,
  prod_base_url text DEFAULT 'https://api.smsethiopia.com/api/send'::text NOT NULL,
  dev_base_url text DEFAULT 'https://api.smsethiopia.com/api/send'::text NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT sms_settings_pkey PRIMARY KEY (id),
  CONSTRAINT sms_settings_environment_check CHECK ((environment = ANY (ARRAY['development'::text, 'production'::text])))
);
CREATE TABLE public.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  registration_number text NOT NULL,
  full_name text NOT NULL,
  gender text,
  level_id uuid NOT NULL,
  section_id uuid NOT NULL,
  department_id uuid NOT NULL,
  status entity_active DEFAULT 'ACTIVE'::entity_active NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  parent_guardian_name text,
  parent_guardian_telephone text,
  parent_guardian_relationship text,
  telephone text,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_registration_number_key UNIQUE (registration_number)
);
CREATE TABLE public.trainer_departments (
  trainer_registry_id uuid NOT NULL,
  department_id uuid NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT trainer_departments_pkey PRIMARY KEY (trainer_registry_id, department_id)
);
CREATE TABLE public.trainer_registry (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  full_name text NOT NULL,
  hidden_staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  phone text,
  qualifications text[] DEFAULT '{}'::text[] NOT NULL,
  department_id uuid NOT NULL,
  status entity_status DEFAULT 'ACTIVE'::entity_status NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sessions_target integer DEFAULT 15 NOT NULL,
  sessions_completed integer DEFAULT 0 NOT NULL,
  staff_code text,
  CONSTRAINT trainer_registry_pkey PRIMARY KEY (id),
  CONSTRAINT trainer_registry_email_key UNIQUE (email),
  CONSTRAINT trainer_registry_hidden_staff_id_key UNIQUE (hidden_staff_id)
);
CREATE TABLE public.trainer_skills (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  trainer_registry_id uuid NOT NULL,
  module_code text NOT NULL,
  qualification_level text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT trainer_skills_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);
CREATE TABLE public.venues (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type venue_type DEFAULT 'Classroom'::venue_type NOT NULL,
  latitude numeric DEFAULT 0 NOT NULL,
  longitude numeric DEFAULT 0 NOT NULL,
  geo_radius numeric DEFAULT 50 NOT NULL,
  capacity integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT venues_pkey PRIMARY KEY (id)
);


-- ============ 3. FOREIGN KEYS ============

ALTER TABLE public.approval_queue ADD CONSTRAINT approval_queue_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
ALTER TABLE public.attendance_logs ADD CONSTRAINT attendance_logs_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance_overrides ADD CONSTRAINT attendance_overrides_attendance_log_id_fkey FOREIGN KEY (attendance_log_id) REFERENCES attendance_logs(id) ON DELETE CASCADE;
ALTER TABLE public.attendance_overrides ADD CONSTRAINT attendance_overrides_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.department_heads ADD CONSTRAINT department_heads_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE public.department_heads ADD CONSTRAINT department_heads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.external_contacts ADD CONSTRAINT external_contacts_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE public.global_config ADD CONSTRAINT global_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_trainer_registry_id_fkey FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE CASCADE;
ALTER TABLE public.levels ADD CONSTRAINT levels_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.modules ADD CONSTRAINT modules_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.modules ADD CONSTRAINT modules_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_trainer_registry_fk FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE SET NULL;
ALTER TABLE public.schedule_feedback_messages ADD CONSTRAINT schedule_feedback_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id);
ALTER TABLE public.schedule_feedback_messages ADD CONSTRAINT schedule_feedback_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES schedule_feedback_threads(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_feedback_threads ADD CONSTRAINT schedule_feedback_threads_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES profiles(id);
ALTER TABLE public.schedule_feedback_threads ADD CONSTRAINT schedule_feedback_threads_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE public.schedule_feedback_threads ADD CONSTRAINT schedule_feedback_threads_dh_id_fkey FOREIGN KEY (dh_id) REFERENCES profiles(id);
ALTER TABLE public.schedule_feedback_threads ADD CONSTRAINT schedule_feedback_threads_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semester_registry(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semester_registry(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_trainer_registry_id_fkey FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_plans ADD CONSTRAINT schedule_plans_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semester_registry(id) ON DELETE RESTRICT;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_trainer_registry_id_fkey FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE RESTRICT;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE RESTRICT;
ALTER TABLE public.sections ADD CONSTRAINT sections_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.sections ADD CONSTRAINT sections_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT;
ALTER TABLE public.session_logs ADD CONSTRAINT session_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
ALTER TABLE public.sms_recipients ADD CONSTRAINT sms_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sms_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.sms_scheduled_recipients ADD CONSTRAINT sms_scheduled_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES sms_campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.sms_settings ADD CONSTRAINT sms_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.students ADD CONSTRAINT students_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.students ADD CONSTRAINT students_level_id_fkey FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE RESTRICT;
ALTER TABLE public.students ADD CONSTRAINT students_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT;
ALTER TABLE public.trainer_departments ADD CONSTRAINT trainer_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE public.trainer_departments ADD CONSTRAINT trainer_departments_trainer_registry_id_fkey FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE CASCADE;
ALTER TABLE public.trainer_registry ADD CONSTRAINT trainer_registry_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
ALTER TABLE public.trainer_skills ADD CONSTRAINT trainer_skills_trainer_registry_id_fkey FOREIGN KEY (trainer_registry_id) REFERENCES trainer_registry(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============ 4. INDEXES ============

CREATE UNIQUE INDEX attendance_logs_schedule_student_uniq ON public.attendance_logs USING btree (schedule_id, student_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action_type);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp" DESC);
CREATE INDEX auth_events_created_at_idx ON public.auth_events USING btree (created_at DESC);
CREATE INDEX auth_events_kind_created_at_idx ON public.auth_events USING btree (kind, created_at DESC);
CREATE UNIQUE INDEX departments_code_key ON public.departments USING btree (upper(code));
CREATE UNIQUE INDEX external_contacts_phone_active_uidx ON public.external_contacts USING btree (phone) WHERE active;
CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles USING btree (phone) WHERE ((phone IS NOT NULL) AND (phone <> ''::text));
CREATE UNIQUE INDEX schedule_feedback_threads_sem_week_uidx ON public.schedule_feedback_threads USING btree (semester_id, COALESCE(week_num, '-1'::integer));
CREATE INDEX schedule_plans_department_idx ON public.schedule_plans USING btree (department_id);
CREATE INDEX schedules_conflict_section ON public.schedules USING btree (section_id, date, start_time, end_time);
CREATE INDEX schedules_conflict_trainer ON public.schedules USING btree (trainer_registry_id, date, start_time, end_time);
CREATE INDEX schedules_conflict_venue ON public.schedules USING btree (venue_id, date, start_time, end_time);
CREATE INDEX schedules_plan_id_idx ON public.schedules USING btree (plan_id);
CREATE UNIQUE INDEX sections_dept_level_name_idx ON public.sections USING btree (department_id, level_id, name);
CREATE UNIQUE INDEX session_logs_schedule_uniq ON public.session_logs USING btree (schedule_id);
CREATE INDEX sms_campaigns_due_idx ON public.sms_campaigns USING btree (scheduled_at) WHERE (status = 'SCHEDULED'::text);
CREATE INDEX sms_recipients_campaign_idx ON public.sms_recipients USING btree (campaign_id);
CREATE INDEX sms_scheduled_recipients_campaign_idx ON public.sms_scheduled_recipients USING btree (campaign_id);
CREATE UNIQUE INDEX students_telephone_unique ON public.students USING btree (telephone) WHERE ((telephone IS NOT NULL) AND (telephone <> ''::text));
CREATE INDEX trainer_departments_dept_idx ON public.trainer_departments USING btree (department_id);
CREATE UNIQUE INDEX trainer_departments_one_primary ON public.trainer_departments USING btree (trainer_registry_id) WHERE (is_primary = true);
CREATE UNIQUE INDEX trainer_registry_phone_unique ON public.trainer_registry USING btree (phone) WHERE ((phone IS NOT NULL) AND (phone <> ''::text));


-- ============ 5. GRANTS ============



-- ============ 6. ROW LEVEL SECURITY ============


CREATE POLICY "Users can submit their own pending approvals" ON public.approval_queue FOR INSERT TO authenticated
  WITH CHECK (((submitted_by = auth.uid()) AND (decision = 'pending'::approval_decision)));
CREATE POLICY "approval_queue DH read" ON public.approval_queue FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (((type = 'session'::approval_type) AND (EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = approval_queue.schedule_id) AND (s.department_id = current_department_id()))))) OR ((type = 'semester'::approval_type) AND (EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.semester_id = approval_queue.target_id) AND (s.department_id = current_department_id()))
 LIMIT 1))))));
CREATE POLICY "approval_queue MA all" ON public.approval_queue FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "attendance DH dept read" ON public.attendance_logs FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendance_logs.schedule_id) AND (s.department_id = current_department_id()))))));
CREATE POLICY "attendance MA all" ON public.attendance_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "attendance T own schedule" ON public.attendance_logs FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendance_logs.schedule_id) AND (s.trainer_registry_id = current_trainer_registry_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = attendance_logs.schedule_id) AND (s.trainer_registry_id = current_trainer_registry_id())))));
CREATE POLICY "overrides DH dept" ON public.attendance_overrides FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM (attendance_logs al
     JOIN schedules s ON ((s.id = al.schedule_id)))
  WHERE ((al.id = attendance_overrides.attendance_log_id) AND (s.department_id = current_department_id()))))))
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM (attendance_logs al
     JOIN schedules s ON ((s.id = al.schedule_id)))
  WHERE ((al.id = attendance_overrides.attendance_log_id) AND (s.department_id = current_department_id()))))));
CREATE POLICY "overrides MA all" ON public.attendance_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "audit MA read" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "audit self insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK ((actor_id = auth.uid()));
CREATE POLICY "auth_events MA read" ON public.auth_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "auth_events self insert" ON public.auth_events FOR INSERT TO authenticated
  WITH CHECK (((user_id IS NULL) OR (user_id = auth.uid())));
CREATE POLICY "dh MA write" ON public.department_heads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "dh read MA or self" ON public.department_heads FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'MA'::app_role) OR (user_id = auth.uid())));
CREATE POLICY "departments MA write" ON public.departments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "departments read" ON public.departments FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "MA manage external contacts" ON public.external_contacts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "config MA write" ON public.global_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "config read" ON public.global_config FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "leave DH dept read" ON public.leave_requests FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM trainer_registry tr
  WHERE ((tr.id = leave_requests.trainer_registry_id) AND (tr.department_id = current_department_id()))))));
CREATE POLICY "leave MA all" ON public.leave_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "leave T self" ON public.leave_requests FOR ALL TO authenticated
  USING ((trainer_registry_id = current_trainer_registry_id()))
  WITH CHECK ((trainer_registry_id = current_trainer_registry_id()));
CREATE POLICY "levels MA write" ON public.levels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "levels read" ON public.levels FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "modules MA write" ON public.modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "modules read" ON public.modules FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "notifications self" ON public.notifications FOR ALL TO authenticated
  USING (((recipient_id = auth.uid()) OR has_role(auth.uid(), 'MA'::app_role)))
  WITH CHECK (((recipient_id = auth.uid()) OR has_role(auth.uid(), 'MA'::app_role)));
CREATE POLICY "pending_sync DH dept" ON public.pending_sync FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = pending_sync.schedule_id) AND (s.department_id = current_department_id()))))));
CREATE POLICY "pending_sync MA all" ON public.pending_sync FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "pending_sync T self" ON public.pending_sync FOR ALL TO authenticated
  USING ((trainer_registry_id = current_trainer_registry_id()))
  WITH CHECK ((trainer_registry_id = current_trainer_registry_id()));
CREATE POLICY "profiles MA insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'MA'::app_role) OR (id = auth.uid())));
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (((id = auth.uid()) OR has_role(auth.uid(), 'MA'::app_role)));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (((id = auth.uid()) OR has_role(auth.uid(), 'MA'::app_role)));
CREATE POLICY "fb_msgs DH dept read" ON public.schedule_feedback_messages FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM schedule_feedback_threads t
  WHERE ((t.id = schedule_feedback_messages.thread_id) AND (t.department_id = current_department_id()))))));
CREATE POLICY "fb_msgs DH dept write" ON public.schedule_feedback_messages FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM schedule_feedback_threads t
  WHERE ((t.id = schedule_feedback_messages.thread_id) AND (t.department_id = current_department_id())))) AND (sender_id = auth.uid())));
CREATE POLICY "fb_msgs MA all" ON public.schedule_feedback_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "fb_threads DH dept" ON public.schedule_feedback_threads FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "fb_threads MA all" ON public.schedule_feedback_threads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "DH manages plans in own department" ON public.schedule_plans FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())))
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "MA can view all plans" ON public.schedule_plans FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "schedules DH dept" ON public.schedules FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())))
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "schedules MA all" ON public.schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "schedules T self" ON public.schedules FOR SELECT TO authenticated
  USING (((trainer_registry_id = current_trainer_registry_id()) AND (is_published = true)));
CREATE POLICY "sections MA write" ON public.sections FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "sections read" ON public.sections FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "semester MA write" ON public.semester_registry FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "semester read" ON public.semester_registry FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "session_logs DH read" ON public.session_logs FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = session_logs.schedule_id) AND (s.department_id = current_department_id()))))));
CREATE POLICY "session_logs MA all" ON public.session_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "session_logs T own" ON public.session_logs FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = session_logs.schedule_id) AND (s.trainer_registry_id = current_trainer_registry_id())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM schedules s
  WHERE ((s.id = session_logs.schedule_id) AND (s.trainer_registry_id = current_trainer_registry_id())))));
CREATE POLICY "MA manage sms campaigns" ON public.sms_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "MA manage sms recipients" ON public.sms_recipients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "MA read scheduled recipients" ON public.sms_scheduled_recipients FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "MA manage sms settings" ON public.sms_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "students DH read" ON public.students FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "students DH update" ON public.students FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())))
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "students DH write" ON public.students FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "students MA all" ON public.students FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "DH/Trainer read trainer_departments" ON public.trainer_departments FOR SELECT TO public
  USING ((has_role(auth.uid(), 'MA'::app_role) OR (has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())) OR (trainer_registry_id = current_trainer_registry_id())));
CREATE POLICY "MA full access trainer_departments" ON public.trainer_departments FOR ALL TO public
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "trainer_registry DH read" ON public.trainer_registry FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "trainer_registry DH read multi-dept" ON public.trainer_registry FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM trainer_departments td
  WHERE ((td.trainer_registry_id = trainer_registry.id) AND (td.department_id = current_department_id()))))));
CREATE POLICY "trainer_registry DH update" ON public.trainer_registry FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())))
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "trainer_registry DH write" ON public.trainer_registry FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'DH'::app_role) AND (department_id = current_department_id())));
CREATE POLICY "trainer_registry MA all" ON public.trainer_registry FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "trainer_registry T self" ON public.trainer_registry FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'T'::app_role) AND (id = current_trainer_registry_id())));
CREATE POLICY "trainer_skills DH read" ON public.trainer_skills FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'DH'::app_role) AND (EXISTS ( SELECT 1
   FROM trainer_registry tr
  WHERE ((tr.id = trainer_skills.trainer_registry_id) AND (tr.department_id = current_department_id()))))));
CREATE POLICY "trainer_skills MA all" ON public.trainer_skills FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "trainer_skills T self" ON public.trainer_skills FOR SELECT TO authenticated
  USING ((trainer_registry_id = current_trainer_registry_id()));
CREATE POLICY "user_roles MA all" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));
CREATE POLICY "venues MA write" ON public.venues FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (has_role(auth.uid(), 'MA'::app_role));
CREATE POLICY "venues read" ON public.venues FOR SELECT TO authenticated
  USING (true);


-- ============ 7. FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.admin_set_dh_department(_user_id uuid, _department_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  UPDATE public.profiles SET department_id = _department_id WHERE id = _user_id;
  DELETE FROM public.department_heads WHERE user_id = _user_id;
  INSERT INTO public.department_heads(user_id, department_id) VALUES (_user_id, _department_id)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'SET_DH_DEPARTMENT', 'profiles', _user_id::text,
          jsonb_build_object('department_id', _department_id));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_trainer_departments(_user_id uuid, _department_ids uuid[], _primary_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tr uuid; v_prim uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT trainer_registry_id INTO v_tr FROM public.profiles WHERE id = _user_id;
  IF v_tr IS NULL THEN
    -- auto-create trainer_registry row if missing
    v_tr := public.link_trainer_login(_user_id, _primary_id);
  END IF;
  IF array_length(_department_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one department is required';
  END IF;
  v_prim := COALESCE(_primary_id, _department_ids[1]);
  IF NOT (v_prim = ANY(_department_ids)) THEN
    RAISE EXCEPTION 'Primary department must be in the list';
  END IF;

  DELETE FROM public.trainer_departments WHERE trainer_registry_id = v_tr;
  INSERT INTO public.trainer_departments(trainer_registry_id, department_id, is_primary)
  SELECT v_tr, d, (d = v_prim) FROM unnest(_department_ids) d;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'SET_TRAINER_DEPARTMENTS', 'trainer_registry', v_tr::text,
          jsonb_build_object('departments', _department_ids, 'primary', v_prim));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_update_user_roles(_user_id uuid, _roles app_role[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ma_count int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  IF _user_id = auth.uid() AND NOT ('MA'::app_role = ANY(_roles)) THEN
    RAISE EXCEPTION 'You cannot remove your own MA role';
  END IF;
  -- Compute new MA count if we apply this change
  SELECT COUNT(DISTINCT user_id) INTO v_ma_count
    FROM public.user_roles
    WHERE role = 'MA'::app_role AND user_id <> _user_id;
  IF 'MA'::app_role = ANY(_roles) THEN v_ma_count := v_ma_count + 1; END IF;
  IF v_ma_count < 1 THEN
    RAISE EXCEPTION 'At least one Master Admin must remain';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  IF array_length(_roles, 1) IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role)
    SELECT _user_id, r FROM unnest(_roles) r
    ON CONFLICT DO NOTHING;
  END IF;

  -- Sync department_heads membership: remove if DH no longer in roles
  IF NOT ('DH'::app_role = ANY(_roles)) THEN
    DELETE FROM public.department_heads WHERE user_id = _user_id;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'UPDATE_USER_ROLES', 'user_roles', _user_id::text,
          jsonb_build_object('roles', _roles));
END $function$;

CREATE OR REPLACE FUNCTION public.audit_logs_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only and cannot be % ', TG_OP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_user_as_ma()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'MA');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_department_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.current_trainer_registry_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT trainer_registry_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.decide_approval(_id uuid, _decision approval_decision, _comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.approval_queue;
  v_dept_id uuid;
  v_dh_user uuid;
  v_title text;
  v_body text;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  SELECT * INTO v_row FROM public.approval_queue WHERE id = _id;
  IF v_row IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;

  UPDATE public.approval_queue
    SET decision = _decision, decided_by = auth.uid(), decided_at = now(), comment = _comment
    WHERE id = _id;

  -- Find the owning department for notifications
  IF v_row.type = 'session' THEN
    SELECT department_id INTO v_dept_id FROM public.schedules WHERE id = v_row.target_id;
  ELSE
    SELECT department_id INTO v_dept_id FROM public.schedules WHERE semester_id = v_row.target_id LIMIT 1;
  END IF;
  SELECT user_id INTO v_dh_user FROM public.department_heads WHERE department_id = v_dept_id LIMIT 1;

  IF _decision = 'approved' THEN
    IF v_row.type = 'session' THEN
      UPDATE public.schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE public.semester_registry SET status='LIVE', distribution_status='PUBLISHED', approved_by=auth.uid(), approved_at=now()
        WHERE id = v_row.target_id;
      UPDATE public.schedules SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
        WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;

    v_title := CASE WHEN v_row.type='semester' THEN 'Semester approved & published' ELSE 'Session approved & published' END;
    v_body  := COALESCE(NULLIF(_comment,''), 'Schedule is now live for trainers.');

    -- Notify DH
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, v_title, v_body);
    END IF;

    -- Notify assigned trainers (whose profile.user_id maps via trainer_registry_id)
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT DISTINCT p.id, 'New schedule available', 'Your timetable was just published. Open the app to view today''s sessions.'
      FROM public.schedules s
      JOIN public.profiles p ON p.trainer_registry_id = s.trainer_registry_id
     WHERE (v_row.type='session' AND s.id = v_row.target_id)
        OR (v_row.type='semester' AND s.semester_id = v_row.target_id)
       AND s.is_published = true;

  ELSIF _decision = 'rejected' THEN
    IF v_row.type = 'session' THEN
      UPDATE public.schedules SET status='DRAFT' WHERE id = v_row.target_id AND status='PENDING_MA';
    ELSE
      UPDATE public.semester_registry SET status='DRAFT', distribution_status='DRAFT' WHERE id = v_row.target_id;
      UPDATE public.schedules SET status='DRAFT' WHERE semester_id = v_row.target_id AND status='PENDING_MA';
    END IF;

    v_title := CASE WHEN v_row.type='semester' THEN 'Semester sent back for changes' ELSE 'Session sent back for changes' END;
    v_body  := COALESCE(NULLIF(_comment,''), 'Admin returned the request. Please review feedback.');
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, v_title, v_body);
    END IF;
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(),
          CASE WHEN _decision='approved' THEN 'APPROVE' ELSE 'REJECT' END,
          v_row.type::text,
          v_row.target_id::text,
          jsonb_build_object('decision', _decision, 'comment', _comment, 'approval_id', _id));
END
$function$;

CREATE OR REPLACE FUNCTION public.dh_delete_draft_session(_schedule_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dept uuid; v_status schedule_status; v_sem uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN
    RAISE EXCEPTION 'DH only';
  END IF;
  SELECT department_id, status, semester_id INTO v_dept, v_status, v_sem
    FROM public.schedules WHERE id = _schedule_id;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;
  IF v_status <> 'DRAFT'::schedule_status THEN
    RAISE EXCEPTION 'Only DRAFT sessions can be deleted (current: %)', v_status;
  END IF;

  -- Clear any pending approval rows pointing at this schedule
  DELETE FROM public.approval_queue
   WHERE type='session' AND schedule_id = _schedule_id AND decision='pending';

  DELETE FROM public.schedules WHERE id = _schedule_id;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'DELETE_DRAFT_SESSION', 'schedules', _schedule_id::text,
          jsonb_build_object('semester_id', v_sem));
END
$function$;

CREATE OR REPLACE FUNCTION public.dh_override_attendance(_attendance_log_id uuid, _new_value boolean, _audit_comment text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_old boolean;
BEGIN
  SELECT present INTO v_old FROM attendance_logs WHERE id = _attendance_log_id;
  INSERT INTO attendance_overrides(attendance_log_id, old_value, new_value, audit_comment, overridden_by)
  VALUES (_attendance_log_id, v_old, _new_value, _audit_comment, auth.uid());
  UPDATE attendance_logs SET present = _new_value WHERE id = _attendance_log_id;
END $function$;

CREATE OR REPLACE FUNCTION public.dh_reply_feedback(_thread_id uuid, _message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) AND NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;
  IF _message IS NULL OR length(trim(_message))=0 THEN RAISE EXCEPTION 'Message required'; END IF;

  SELECT department_id INTO v_dept FROM public.schedule_feedback_threads WHERE id = _thread_id;
  IF public.has_role(auth.uid(),'DH'::app_role) AND v_dept <> public.current_department_id() THEN
    RAISE EXCEPTION 'Out of department';
  END IF;

  INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
  VALUES (_thread_id, auth.uid(), _message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dh_resubmit_semester(_semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  UPDATE public.semester_registry SET status = 'PENDING_MA', distribution_status = 'PENDING_MA' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'PENDING_MA' WHERE semester_id = _semester_id AND status = 'DRAFT';

  INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
  SELECT 'semester'::approval_type, _semester_id, NULL, auth.uid(), 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.approval_queue WHERE target_id = _semester_id AND decision = 'pending'
  );

  -- Notify all MAs
  INSERT INTO public.notifications(recipient_id, title, body)
  SELECT ur.user_id, 'Semester resubmitted', 'A Department Head resubmitted a semester after addressing your feedback.'
    FROM public.user_roles ur
   WHERE ur.role = 'MA'::app_role;

  -- Audit
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'RESUBMIT', 'semester', _semester_id::text,
          jsonb_build_object('semester_id', _semester_id));
END
$function$;

CREATE OR REPLACE FUNCTION public.dh_resubmit_week(_semester_id uuid, _week_num integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dept uuid;
  v_count int := 0;
  v_sched RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  FOR v_sched IN
    SELECT id FROM public.schedules
     WHERE semester_id = _semester_id AND week_num = _week_num AND status = 'DRAFT'
  LOOP
    UPDATE public.schedules SET status='PENDING_MA' WHERE id = v_sched.id;
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_count := v_count + 1;
  END LOOP;

  -- Notify all MAs
  IF v_count > 0 THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT ur.user_id, 'Week ' || _week_num || ' resubmitted',
           'DH resubmitted ' || v_count || ' session(s) after addressing feedback.'
      FROM public.user_roles ur WHERE ur.role = 'MA'::app_role;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'RESUBMIT_WEEK', 'week', _semester_id::text || ':' || _week_num::text,
            jsonb_build_object('semester_id', _semester_id, 'week_num', _week_num, 'count', v_count));
  END IF;

  RETURN v_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.dh_save_schedule_plan(_plan jsonb, _sessions jsonb, _plan_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dept uuid;
  v_plan_id uuid;
  v_mod record;
  v_level record;
  v_section record;
  v_venue record;
  v_trainer record;
  v_sem record;
  v_count int := 0;
  v_conflict record;
  s jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'DH'::app_role) THEN
    RAISE EXCEPTION 'Department Head only';
  END IF;
  v_dept := public.current_department_id();
  IF v_dept IS NULL THEN
    RAISE EXCEPTION 'No department assigned to this Department Head account.';
  END IF;
  IF (_plan->>'department_id')::uuid <> v_dept THEN
    RAISE EXCEPTION 'Out of department';
  END IF;
  IF _sessions IS NULL OR jsonb_array_length(_sessions) = 0 THEN
    RAISE EXCEPTION 'No sessions to save — check teaching days, duration and start date.';
  END IF;

  SELECT * INTO v_sem FROM public.semester_registry WHERE id = (_plan->>'semester_id')::uuid;
  IF v_sem IS NULL THEN RAISE EXCEPTION 'The selected academic term no longer exists.'; END IF;

  SELECT * INTO v_level FROM public.levels WHERE id = (_plan->>'level_id')::uuid;
  IF v_level IS NULL THEN RAISE EXCEPTION 'The selected Level no longer exists.'; END IF;
  IF v_level.department_id <> v_dept THEN RAISE EXCEPTION 'That Level does not belong to your department.'; END IF;

  SELECT * INTO v_mod FROM public.modules WHERE id = (_plan->>'module_id')::uuid;
  IF v_mod IS NULL THEN RAISE EXCEPTION 'The selected Module no longer exists.'; END IF;
  IF v_mod.department_id <> v_dept THEN RAISE EXCEPTION 'That Module does not belong to your department.'; END IF;
  IF v_mod.level_id <> v_level.id THEN
    RAISE EXCEPTION 'Module % belongs to a different Level. Choose a module for the selected Level.', v_mod.code;
  END IF;

  SELECT * INTO v_section FROM public.sections WHERE id = (_plan->>'section_id')::uuid;
  IF v_section IS NULL THEN RAISE EXCEPTION 'The selected Section no longer exists.'; END IF;
  IF v_section.department_id <> v_dept THEN RAISE EXCEPTION 'That Section does not belong to your department.'; END IF;
  IF v_section.level_id <> v_level.id THEN RAISE EXCEPTION 'That Section does not belong to the selected Level.'; END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = (_plan->>'venue_id')::uuid;
  IF v_venue IS NULL THEN RAISE EXCEPTION 'The selected Venue no longer exists.'; END IF;

  SELECT * INTO v_trainer FROM public.trainer_registry WHERE id = (_plan->>'trainer_registry_id')::uuid;
  IF v_trainer IS NULL THEN RAISE EXCEPTION 'The selected Trainer no longer exists.'; END IF;
  IF v_trainer.department_id <> v_dept AND NOT EXISTS (
    SELECT 1 FROM public.trainer_departments td
     WHERE td.trainer_registry_id = v_trainer.id AND td.department_id = v_dept
  ) THEN
    RAISE EXCEPTION 'That Trainer is not assigned to your department.';
  END IF;

  -- Replacing an existing plan: drop its draft sessions first (same transaction).
  IF _plan_id IS NOT NULL THEN
    SELECT id INTO v_plan_id FROM public.schedule_plans WHERE id = _plan_id AND department_id = v_dept;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Plan not found in your department'; END IF;
    IF EXISTS (SELECT 1 FROM public.schedules WHERE plan_id = v_plan_id AND status <> 'DRAFT'::schedule_status) THEN
      RAISE EXCEPTION 'This schedule has already been submitted and can no longer be regenerated.';
    END IF;
    DELETE FROM public.approval_queue
      WHERE type = 'session' AND decision = 'pending'
        AND schedule_id IN (SELECT id FROM public.schedules WHERE plan_id = v_plan_id);
    DELETE FROM public.schedules WHERE plan_id = v_plan_id;
  END IF;

  -- Conflict detection on the real generated session time ranges.
  SELECT o.date, o.start_time, o.end_time, x.module_code, x.trainer_registry_id, x.venue_id, x.section_id
    INTO v_conflict
    FROM jsonb_to_recordset(_sessions) AS o(date date, start_time time, end_time time)
    JOIN public.schedules x
      ON x.date = o.date
     AND x.status IN ('DRAFT','PENDING_MA','LIVE','ACTIVE')
     AND (v_plan_id IS NULL OR x.plan_id IS DISTINCT FROM v_plan_id)
     AND o.start_time < x.end_time AND o.end_time > x.start_time
     AND (
          x.trainer_registry_id = v_trainer.id
       OR x.venue_id = v_venue.id
       OR (x.section_id = v_section.id AND x.department_id = v_dept)
     )
   LIMIT 1;

  IF v_conflict.date IS NOT NULL THEN
    RAISE EXCEPTION 'Clash on % at %–%: % is already booked. Change the time, day, trainer or venue.',
      v_conflict.date, to_char(v_conflict.start_time,'HH24:MI'), to_char(v_conflict.end_time,'HH24:MI'),
      CASE WHEN v_conflict.trainer_registry_id = v_trainer.id THEN 'the trainer'
           WHEN v_conflict.venue_id = v_venue.id THEN 'the venue'
           ELSE 'the section' END;
  END IF;

  INSERT INTO public.schedule_plans (
    id, semester_id, department_id, level_id, module_id, module_code, module_name,
    section_id, venue_id, trainer_registry_id, delivery, theory_days, practical_days,
    sessions_per_week, session_minutes, module_total_minutes, start_date, start_time,
    end_date, total_sessions, total_minutes, weeks, created_by
  ) VALUES (
    COALESCE(v_plan_id, gen_random_uuid()),
    (_plan->>'semester_id')::uuid, v_dept, v_level.id, v_mod.id, v_mod.code, v_mod.name,
    v_section.id, v_venue.id, v_trainer.id,
    COALESCE(_plan->>'delivery','Theory'),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(_plan->'theory_days','[]'::jsonb)) value), '{}'),
    COALESCE((SELECT array_agg(value::text) FROM jsonb_array_elements_text(COALESCE(_plan->'practical_days','[]'::jsonb)) value), '{}'),
    COALESCE((_plan->>'sessions_per_week')::int, 1),
    (_plan->>'session_minutes')::int,
    (_plan->>'module_total_minutes')::int,
    (_plan->>'start_date')::date,
    (_plan->>'start_time')::time,
    (_plan->>'end_date')::date,
    COALESCE((_plan->>'total_sessions')::int, 0),
    COALESCE((_plan->>'total_minutes')::int, 0),
    COALESCE((_plan->>'weeks')::int, 0),
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    semester_id = EXCLUDED.semester_id, level_id = EXCLUDED.level_id,
    module_id = EXCLUDED.module_id, module_code = EXCLUDED.module_code, module_name = EXCLUDED.module_name,
    section_id = EXCLUDED.section_id, venue_id = EXCLUDED.venue_id,
    trainer_registry_id = EXCLUDED.trainer_registry_id, delivery = EXCLUDED.delivery,
    theory_days = EXCLUDED.theory_days, practical_days = EXCLUDED.practical_days,
    sessions_per_week = EXCLUDED.sessions_per_week, session_minutes = EXCLUDED.session_minutes,
    module_total_minutes = EXCLUDED.module_total_minutes, start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time, end_date = EXCLUDED.end_date,
    total_sessions = EXCLUDED.total_sessions, total_minutes = EXCLUDED.total_minutes,
    weeks = EXCLUDED.weeks
  RETURNING id INTO v_plan_id;

  FOR s IN SELECT * FROM jsonb_array_elements(_sessions) LOOP
    INSERT INTO public.schedules (
      semester_id, department_id, level_id, section_id, venue_id,
      module_code, module_name, trainer_registry_id, hidden_staff_id, trainer_name,
      date, day, week_num, start_time, end_time, status, created_by,
      plan_id, session_number, mode
    ) VALUES (
      (_plan->>'semester_id')::uuid, v_dept, v_level.id, v_section.id, v_venue.id,
      v_mod.code, v_mod.name, v_trainer.id, v_trainer.hidden_staff_id, v_trainer.full_name,
      (s->>'date')::date, s->>'day', (s->>'week_num')::int,
      (s->>'start_time')::time, (s->>'end_time')::time,
      'DRAFT'::schedule_status, auth.uid(),
      v_plan_id, (s->>'session_number')::int,
      NULLIF(s->>'mode','')::session_mode
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.semester_registry SET distribution_status = 'DRAFT'
   WHERE id = (_plan->>'semester_id')::uuid AND distribution_status NOT IN ('PENDING_MA','PUBLISHED');

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), CASE WHEN _plan_id IS NULL THEN 'DH_SAVE_SCHEDULE_PLAN' ELSE 'DH_REGENERATE_SCHEDULE_PLAN' END,
          'schedule_plans', v_plan_id::text,
          jsonb_build_object('module', v_mod.code, 'sessions', v_count,
                             'weeks', (_plan->>'weeks')::int, 'end_date', _plan->>'end_date'));

  RETURN jsonb_build_object('ok', true, 'plan_id', v_plan_id, 'sessions', v_count);
END
$function$;

CREATE OR REPLACE FUNCTION public.dh_submit_semester_per_week(_semester_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dept uuid; v_created int := 0; v_sched record;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) THEN RAISE EXCEPTION 'DH only'; END IF;
  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id=_semester_id LIMIT 1;
  IF v_dept IS NULL THEN RAISE EXCEPTION 'No schedules for semester'; END IF;
  IF v_dept <> public.current_department_id() THEN RAISE EXCEPTION 'Out of department'; END IF;

  FOR v_sched IN
    SELECT s.id FROM public.schedules s
     WHERE s.semester_id=_semester_id
       AND s.status IN ('DRAFT','PENDING_MA')
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_queue aq
          WHERE aq.type='session' AND aq.schedule_id=s.id AND aq.decision='pending'
       )
  LOOP
    INSERT INTO public.approval_queue(type,target_id,schedule_id,submitted_by,decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_created := v_created+1;
  END LOOP;

  UPDATE public.schedules SET status='PENDING_MA'
    WHERE semester_id=_semester_id AND status='DRAFT';

  UPDATE public.semester_registry SET status='PENDING_MA', distribution_status='PENDING_MA'
    WHERE id=_semester_id;

  -- Close any pending semester-level approval (DH switched to per-week)
  UPDATE public.approval_queue
     SET decision='approved', decided_by=auth.uid(), decided_at=now(),
         comment=COALESCE(comment,'')||CASE WHEN COALESCE(comment,'')='' THEN '' ELSE E'\n' END||'Switched to per-week submission'
   WHERE type='semester' AND target_id=_semester_id AND decision='pending';

  INSERT INTO public.notifications(recipient_id,title,body)
  SELECT ur.user_id,'Per-week approval submitted',
         'DH submitted '||v_created||' weekly session(s) for review.'
    FROM public.user_roles ur WHERE ur.role='MA'::app_role;

  INSERT INTO public.audit_logs(actor_id,action_type,entity_type,entity_id,after_state)
  VALUES (auth.uid(),'SUBMIT_PER_WEEK','semester',_semester_id::text,
          jsonb_build_object('semester_id',_semester_id,'created',v_created));

  RETURN jsonb_build_object('created', v_created);
END $function$;

CREATE OR REPLACE FUNCTION public.dh_swap_trainer(_schedule_id uuid, _new_trainer uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dept uuid; v_old uuid; v_sched_dept uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'DH'::app_role) AND NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;
  SELECT department_id INTO v_dept FROM profiles WHERE id = auth.uid();
  SELECT department_id, trainer_registry_id INTO v_sched_dept, v_old FROM schedules WHERE id = _schedule_id;
  IF NOT public.has_role(auth.uid(),'MA'::app_role) AND v_sched_dept <> v_dept THEN
    RAISE EXCEPTION 'Out of department';
  END IF;
  UPDATE schedules
    SET trainer_registry_id = _new_trainer,
        hidden_staff_id = (SELECT hidden_staff_id FROM trainer_registry WHERE id = _new_trainer),
        trainer_name    = (SELECT full_name      FROM trainer_registry WHERE id = _new_trainer)
  WHERE id = _schedule_id;
  INSERT INTO audit_logs(actor_id, action_type, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'SWAP_TRAINER', 'schedules', _schedule_id::text,
          jsonb_build_object('trainer_registry_id', v_old),
          jsonb_build_object('trainer_registry_id', _new_trainer, 'reason', _reason));
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_attendance_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE locked timestamptz;
BEGIN
  SELECT s.attendance_locked_at INTO locked
  FROM public.attendance_logs al
  JOIN public.schedules s ON s.id = al.schedule_id
  WHERE al.id = NEW.attendance_log_id;
  IF locked IS NOT NULL AND now() > locked + interval '24 hours' THEN
    RAISE EXCEPTION '24-hour override window has expired';
  END IF;
  IF NEW.audit_comment IS NULL OR length(trim(NEW.audit_comment)) = 0 THEN
    RAISE EXCEPTION 'Audit comment is required for attendance overrides';
  END IF;
  IF NOT (public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'MA'::app_role)) THEN
    RAISE EXCEPTION 'Only DH or MA can override attendance';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_schedule_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE legal boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  legal := (OLD.status, NEW.status) IN (
    ('DRAFT','PENDING_MA'),
    ('DRAFT','CANCELLED'),
    ('PENDING_MA','LIVE'),
    ('PENDING_MA','DRAFT'),
    ('PENDING_MA','CANCELLED'),
    ('LIVE','ACTIVE'),
    ('LIVE','CANCELLED'),
    ('ACTIVE','ENDED'),
    ('LIVE','ENDED')
  );
  IF NOT legal THEN
    RAISE EXCEPTION 'Illegal schedule transition % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$;

CREATE OR REPLACE FUNCTION public.link_trainer_login(_profile_id uuid, _department_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.ma_decide_week(_department_id uuid, _week_num integer, _decision approval_decision, _message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_aq RECORD;
  v_semester_id uuid;
  v_dh_user uuid;
  v_thread uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;

  IF _decision = 'rejected' AND (_message IS NULL OR length(trim(_message)) < 3) THEN
    RAISE EXCEPTION 'Feedback message required to send back';
  END IF;

  SELECT user_id INTO v_dh_user FROM public.department_heads WHERE department_id = _department_id LIMIT 1;

  FOR v_aq IN
    SELECT aq.id, aq.schedule_id, s.semester_id
      FROM public.approval_queue aq
      JOIN public.schedules s ON s.id = aq.schedule_id
     WHERE aq.type = 'session'
       AND aq.decision = 'pending'
       AND s.department_id = _department_id
       AND s.week_num = _week_num
  LOOP
    v_semester_id := v_aq.semester_id;
    IF _decision = 'approved' THEN
      UPDATE public.approval_queue
         SET decision='approved', decided_by=auth.uid(), decided_at=now(), comment=_message
       WHERE id = v_aq.id;
      UPDATE public.schedules
         SET status='LIVE', is_published=true, published_at=now(), published_by=auth.uid()
       WHERE id = v_aq.schedule_id AND status='PENDING_MA';
    ELSE
      UPDATE public.approval_queue
         SET decision='rejected', decided_by=auth.uid(), decided_at=now(),
             comment = COALESCE(comment,'') || CASE WHEN comment IS NULL OR comment='' THEN '' ELSE E'\n' END || _message
       WHERE id = v_aq.id;
      UPDATE public.schedules SET status='DRAFT' WHERE id = v_aq.schedule_id AND status='PENDING_MA';
    END IF;
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('count', 0);
  END IF;

  IF _decision = 'approved' THEN
    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, 'Week ' || _week_num || ' approved & published',
              COALESCE(NULLIF(_message,''), v_count || ' session(s) are now live.'));
    END IF;
    -- Notify each assigned trainer for this dept+week
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT DISTINCT p.id, 'New sessions published',
           'Week ' || _week_num || ' was just approved. Open the app to view your schedule.'
      FROM public.schedules s
      JOIN public.profiles p ON p.trainer_registry_id = s.trainer_registry_id
     WHERE s.department_id = _department_id
       AND s.week_num = _week_num
       AND s.is_published = true;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'APPROVE_WEEK', 'week', _department_id::text || ':' || _week_num::text,
            jsonb_build_object('department_id', _department_id, 'week_num', _week_num, 'count', v_count, 'comment', _message));
  ELSE
    -- Reject: open/append a per-week feedback thread on the (last seen) semester
    IF v_semester_id IS NOT NULL THEN
      INSERT INTO public.schedule_feedback_threads(semester_id, department_id, admin_id, dh_id, week_num)
      VALUES (v_semester_id, _department_id, auth.uid(), v_dh_user, _week_num)
      ON CONFLICT (semester_id, COALESCE(week_num,-1))
      DO UPDATE SET admin_id = EXCLUDED.admin_id,
                    dh_id = COALESCE(public.schedule_feedback_threads.dh_id, EXCLUDED.dh_id)
      RETURNING id INTO v_thread;

      INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
      VALUES (v_thread, auth.uid(), 'Week ' || _week_num || ' feedback: ' || _message);
    END IF;

    IF v_dh_user IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body)
      VALUES (v_dh_user, 'Week ' || _week_num || ' sent back for changes', _message);
    END IF;

    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'REJECT_WEEK_WITH_FEEDBACK', 'week', _department_id::text || ':' || _week_num::text,
            jsonb_build_object('department_id', _department_id, 'week_num', _week_num, 'count', v_count, 'message', _message));
  END IF;

  RETURN jsonb_build_object('count', v_count, 'thread_id', v_thread);
END
$function$;

CREATE OR REPLACE FUNCTION public.ma_delete_schedule(_schedule_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sched public.schedules;
  v_trainer_user uuid;
  v_thread uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason (min 3 chars) is required to delete a schedule';
  END IF;

  SELECT * INTO v_sched FROM public.schedules WHERE id = _schedule_id;
  IF v_sched IS NULL THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;

  SELECT p.id INTO v_trainer_user
    FROM public.profiles p
   WHERE p.trainer_registry_id = v_sched.trainer_registry_id
   LIMIT 1;

  -- Cleanup in FK-safe order
  DELETE FROM public.attendance_overrides ao
   USING public.attendance_logs al
   WHERE ao.attendance_log_id = al.id
     AND al.schedule_id = _schedule_id;

  DELETE FROM public.attendance_logs WHERE schedule_id = _schedule_id;
  DELETE FROM public.session_logs    WHERE schedule_id = _schedule_id;
  DELETE FROM public.pending_sync    WHERE schedule_id = _schedule_id;

  -- Week-scoped feedback threads tied to this schedule's week (semester-level threads kept)
  IF v_sched.semester_id IS NOT NULL AND v_sched.week_num IS NOT NULL THEN
    FOR v_thread IN
      SELECT id FROM public.schedule_feedback_threads
       WHERE semester_id = v_sched.semester_id AND week_num = v_sched.week_num
    LOOP
      DELETE FROM public.schedule_feedback_messages WHERE thread_id = v_thread;
      DELETE FROM public.schedule_feedback_threads  WHERE id = v_thread;
    END LOOP;
  END IF;

  DELETE FROM public.approval_queue
   WHERE (type = 'session' AND (schedule_id = _schedule_id OR target_id = _schedule_id));

  DELETE FROM public.schedules WHERE id = _schedule_id;

  IF v_trainer_user IS NOT NULL AND v_sched.is_published THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_trainer_user, 'Schedule removed by admin',
            COALESCE(v_sched.module_name, v_sched.module_code, 'Session') ||
            ' on ' || v_sched.date::text || ' has been removed. Reason: ' || _reason);
  END IF;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'MA_DELETE_SCHEDULE', 'schedules', _schedule_id::text,
          to_jsonb(v_sched),
          jsonb_build_object('reason', _reason));

  RETURN jsonb_build_object('ok', true, 'id', _schedule_id);
END
$function$;

CREATE OR REPLACE FUNCTION public.ma_reject_semester_with_feedback(_semester_id uuid, _message text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_thread uuid;
  v_dept uuid;
  v_dh uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN
    RAISE EXCEPTION 'Feedback message required';
  END IF;

  SELECT department_id INTO v_dept FROM public.schedules WHERE semester_id = _semester_id LIMIT 1;
  SELECT user_id INTO v_dh FROM public.department_heads WHERE department_id = v_dept LIMIT 1;

  INSERT INTO public.schedule_feedback_threads(semester_id, department_id, admin_id, dh_id)
  VALUES (_semester_id, v_dept, auth.uid(), v_dh)
  ON CONFLICT (semester_id) DO UPDATE SET admin_id = EXCLUDED.admin_id, dh_id = COALESCE(public.schedule_feedback_threads.dh_id, EXCLUDED.dh_id)
  RETURNING id INTO v_thread;

  INSERT INTO public.schedule_feedback_messages(thread_id, sender_id, message)
  VALUES (v_thread, auth.uid(), _message);

  UPDATE public.semester_registry SET status = 'DRAFT', distribution_status = 'FEEDBACK_ACTIVE' WHERE id = _semester_id;
  UPDATE public.schedules SET status = 'DRAFT' WHERE semester_id = _semester_id AND status = 'PENDING_MA';

  -- Close out any pending approval queue rows for this semester
  UPDATE public.approval_queue
     SET decision = 'rejected', decided_by = auth.uid(), decided_at = now(),
         comment = COALESCE(comment, '') || CASE WHEN comment IS NULL OR comment='' THEN '' ELSE E'\n' END || _message
   WHERE type='semester' AND target_id = _semester_id AND decision = 'pending';

  IF v_dh IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body)
    VALUES (v_dh, 'Schedule rejected', 'Admin returned the semester for changes. Open the chat to review.');
  END IF;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'REJECT_WITH_FEEDBACK', 'semester', _semester_id::text,
          jsonb_build_object('semester_id', _semester_id, 'message', _message));

  RETURN v_thread;
END
$function$;

CREATE OR REPLACE FUNCTION public.ma_split_semester_to_weeks(_approval_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_semester_id uuid;
  v_type approval_type;
  v_decision approval_decision;
  v_created int := 0;
  v_sched record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'MA'::app_role) THEN
    RAISE EXCEPTION 'MA only';
  END IF;

  SELECT target_id, type, decision INTO v_semester_id, v_type, v_decision
    FROM public.approval_queue WHERE id = _approval_id;
  IF v_semester_id IS NULL THEN RAISE EXCEPTION 'Approval not found'; END IF;
  IF v_type <> 'semester' THEN RAISE EXCEPTION 'Not a semester approval'; END IF;
  IF v_decision <> 'pending' THEN RAISE EXCEPTION 'Approval already decided'; END IF;

  -- Create pending session-level approvals for every schedule in the semester
  -- that does not already have a pending row.
  FOR v_sched IN
    SELECT s.id
      FROM public.schedules s
     WHERE s.semester_id = v_semester_id
       AND NOT EXISTS (
         SELECT 1 FROM public.approval_queue aq
          WHERE aq.type = 'session' AND aq.schedule_id = s.id AND aq.decision = 'pending'
       )
  LOOP
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES ('session', v_sched.id, v_sched.id, auth.uid(), 'pending');
    v_created := v_created + 1;
  END LOOP;

  UPDATE public.schedules
     SET status = 'PENDING_MA'
   WHERE semester_id = v_semester_id AND status = 'DRAFT';

  -- Resolve the semester-level approval
  UPDATE public.approval_queue
     SET decision = 'approved',
         decided_by = auth.uid(),
         decided_at = now(),
         comment = COALESCE(comment,'') || CASE WHEN COALESCE(comment,'')='' THEN '' ELSE E'\n' END || 'Split into weeks'
   WHERE id = _approval_id;

  UPDATE public.semester_registry
     SET distribution_status = 'PENDING_MA'
   WHERE id = v_semester_id;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (auth.uid(), 'SPLIT_SEMESTER_TO_WEEKS', 'semester', v_semester_id::text,
          jsonb_build_object('approval_id', _approval_id, 'created_session_approvals', v_created));

  RETURN jsonb_build_object('semester_id', v_semester_id, 'created', v_created);
END
$function$;

CREATE OR REPLACE FUNCTION public.next_entity_code(_department_id uuid, _kind text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END $function$;

CREATE OR REPLACE FUNCTION public.phone_owner(_phone text)
 RETURNS TABLE(kind text, name text, id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'staff'::text, p.full_name, p.id FROM public.profiles p
   WHERE p.phone = _phone
  UNION ALL
  SELECT 'trainer'::text, t.full_name, t.id FROM public.trainer_registry t
   WHERE t.phone = _phone
  UNION ALL
  SELECT 'student'::text, s.full_name, s.id FROM public.students s
   WHERE s.telephone = _phone
$function$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'MA'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.trainer_registry_id IS DISTINCT FROM OLD.trainer_registry_id
     OR NEW.department_id     IS DISTINCT FROM OLD.department_id
     OR NEW.bypass_geofence   IS DISTINCT FROM OLD.bypass_geofence
     OR NEW.active            IS DISTINCT FROM OLD.active THEN
    RAISE EXCEPTION 'Only Master Admins can change trainer_registry_id, department_id, bypass_geofence, or active';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_academic_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_actor, 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;

  TRUNCATE TABLE
    public.attendance_overrides,
    public.attendance_logs,
    public.session_logs,
    public.pending_sync,
    public.schedule_feedback_messages,
    public.schedule_feedback_threads,
    public.approval_queue,
    public.schedules,
    public.semester_registry,
    public.students,
    public.trainer_skills,
    public.modules,
    public.leave_requests,
    public.notifications,
    public.trainer_registry
  RESTART IDENTITY CASCADE;

  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (v_actor, 'RESET_ACADEMIC_DATA', 'system', 'academic',
          jsonb_build_object('at', now()));

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_department_levels()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.levels (department_id, name)
  SELECT NEW.id, l::level_name FROM unnest(ARRAY['I','II','III','IV','V']) l
  ON CONFLICT (department_id, name) DO NOTHING;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.set_session_mode(_schedule_id uuid, _mode session_mode)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tr uuid;
BEGIN
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = _schedule_id AND trainer_registry_id = v_tr) THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;
  UPDATE schedules SET mode = _mode WHERE id = _schedule_id;
END $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at_ts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.submit_for_approval(_type approval_type, _target_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int := 0;
  v_id uuid;
  v_title text;
  v_body text;
  v_dept_name text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'DH'::app_role) OR public.has_role(auth.uid(),'MA'::app_role)) THEN
    RAISE EXCEPTION 'DH or MA only';
  END IF;

  FOREACH v_id IN ARRAY _target_ids LOOP
    INSERT INTO public.approval_queue(type, target_id, schedule_id, submitted_by, decision)
    VALUES (_type, v_id, CASE WHEN _type='session' THEN v_id ELSE NULL END, auth.uid(), 'pending');

    IF _type = 'session' THEN
      UPDATE public.schedules SET status='PENDING_MA' WHERE id = v_id AND status='DRAFT';
    ELSE
      UPDATE public.semester_registry SET status='PENDING_MA', distribution_status='PENDING_MA' WHERE id = v_id;
      UPDATE public.schedules SET status='PENDING_MA' WHERE semester_id = v_id AND status='DRAFT';
    END IF;

    -- Audit
    INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
    VALUES (auth.uid(), 'SUBMIT_FOR_APPROVAL', _type::text, v_id::text,
            jsonb_build_object('type', _type, 'target_id', v_id));

    v_count := v_count + 1;
  END LOOP;

  -- Notify every MA
  IF v_count > 0 THEN
    v_title := CASE WHEN _type='semester' THEN 'New semester approval request' ELSE 'New session approval request' END;
    v_body  := 'A Department Head submitted ' || v_count || ' ' || _type::text || '(s) for your review.';
    INSERT INTO public.notifications(recipient_id, title, body)
    SELECT ur.user_id, v_title, v_body
      FROM public.user_roles ur
     WHERE ur.role = 'MA'::app_role;
  END IF;

  RETURN v_count;
END
$function$;

CREATE OR REPLACE FUNCTION public.submit_session_batch(_client_uuid uuid, _schedule_id uuid, _client_timestamp timestamp with time zone, _lesson_plan text, _learning_outcome text, _latitude numeric, _longitude numeric, _attendance jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_trainer_id uuid;
  v_existing public.pending_sync;
  v_schedule public.schedules;
  v_venue public.venues;
  v_window int;
  v_geo_ok boolean := true;
  v_window_ok boolean := true;
  v_geo_distance numeric;
  v_session_start timestamptz;
  v_attendance_count int := 0;
  v_status text := 'applied';
  v_reason text;
  v_result jsonb;
  v_geo_enabled boolean;
  v_bypass boolean;
  r jsonb;
BEGIN
  SELECT trainer_registry_id INTO v_trainer_id FROM public.profiles WHERE id = auth.uid();
  IF v_trainer_id IS NULL THEN RAISE EXCEPTION 'Not a trainer'; END IF;

  SELECT * INTO v_existing FROM public.pending_sync WHERE client_uuid = _client_uuid;
  IF FOUND THEN
    RETURN jsonb_build_object('status', v_existing.status, 'conflict_reason', v_existing.conflict_reason, 'replayed', true, 'result', v_existing.result);
  END IF;

  SELECT * INTO v_schedule FROM public.schedules WHERE id = _schedule_id;
  IF NOT FOUND OR v_schedule.trainer_registry_id <> v_trainer_id THEN
    RAISE EXCEPTION 'Unauthorized for this schedule';
  END IF;

  SELECT * INTO v_venue FROM public.venues WHERE id = v_schedule.venue_id;
  SELECT attendance_window_minutes, geofence_enabled INTO v_window, v_geo_enabled FROM public.global_config LIMIT 1;
  v_window := COALESCE(v_window, 15);
  SELECT COALESCE(bypass_geofence,false) INTO v_bypass FROM public.profiles WHERE id = auth.uid();

  IF COALESCE(v_geo_enabled,true) AND NOT v_bypass AND _latitude IS NOT NULL AND _longitude IS NOT NULL AND v_venue.latitude IS NOT NULL THEN
    v_geo_distance := 6371000 * acos(
      LEAST(1, cos(radians(v_venue.latitude)) * cos(radians(_latitude))
        * cos(radians(_longitude) - radians(v_venue.longitude))
        + sin(radians(v_venue.latitude)) * sin(radians(_latitude)))
    );
    IF v_geo_distance > COALESCE(v_venue.geo_radius, 50) THEN
      v_geo_ok := false;
      v_status := 'rejected';
      v_reason := 'geo_fence';
    END IF;
  END IF;

  v_session_start := (v_schedule.date::text || ' ' || v_schedule.start_time::text)::timestamptz;
  IF _client_timestamp < v_session_start - (v_window || ' minutes')::interval
     OR _client_timestamp > v_session_start + (v_schedule.end_time - v_schedule.start_time) + (v_window || ' minutes')::interval THEN
    v_window_ok := false;
    IF v_status = 'applied' THEN
      v_status := 'rejected';
      v_reason := 'window_expired';
    END IF;
  END IF;

  IF v_status = 'applied' THEN
    INSERT INTO public.session_logs (schedule_id, lesson_plan, learning_outcome, checkin_latitude, checkin_longitude, geo_verified, session_status, submitted_at)
    VALUES (_schedule_id, _lesson_plan, _learning_outcome, _latitude, _longitude, v_geo_ok, 'COMPLETED', now())
    ON CONFLICT (schedule_id) DO UPDATE
      SET lesson_plan = EXCLUDED.lesson_plan,
          learning_outcome = EXCLUDED.learning_outcome,
          checkin_latitude = EXCLUDED.checkin_latitude,
          checkin_longitude = EXCLUDED.checkin_longitude,
          geo_verified = EXCLUDED.geo_verified,
          session_status = 'COMPLETED',
          submitted_at = now();

    FOR r IN SELECT * FROM jsonb_array_elements(_attendance) LOOP
      INSERT INTO public.attendance_logs (schedule_id, student_id, present, submitted_by, attendance_timestamp)
      VALUES (_schedule_id, (r->>'student_id')::uuid, COALESCE((r->>'present')::boolean, false), auth.uid(), now())
      ON CONFLICT (schedule_id, student_id) DO UPDATE
        SET present = EXCLUDED.present,
            submitted_by = auth.uid(),
            attendance_timestamp = now();
      v_attendance_count := v_attendance_count + 1;
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'attendance_written', v_attendance_count,
    'geo_distance_m', v_geo_distance,
    'geo_ok', v_geo_ok,
    'window_ok', v_window_ok
  );

  INSERT INTO public.pending_sync (client_uuid, trainer_registry_id, schedule_id, kind, payload, client_timestamp, status, conflict_reason, result)
  VALUES (_client_uuid, v_trainer_id, _schedule_id, 'session_batch',
    jsonb_build_object('lesson_plan', _lesson_plan, 'learning_outcome', _learning_outcome, 'attendance', _attendance, 'lat', _latitude, 'lng', _longitude),
    _client_timestamp, v_status, v_reason, v_result);

  RETURN jsonb_build_object('status', v_status, 'conflict_reason', v_reason, 'replayed', false, 'result', v_result);
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_trainer_primary_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_primary THEN
    UPDATE public.trainer_registry SET department_id = NEW.department_id
      WHERE id = NEW.trainer_registry_id;
    -- mirror to profile
    UPDATE public.profiles SET department_id = NEW.department_id
      WHERE trainer_registry_id = NEW.trainer_registry_id;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trainer_checkin(_schedule_id uuid, _latitude numeric, _longitude numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tr uuid;
  v_sched schedules;
  v_venue venues;
  v_distance numeric;
  v_radius numeric;
  v_session_start timestamptz;
  v_session_end timestamptz;
  v_geo_enabled boolean;
  v_bypass boolean;
BEGIN
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  SELECT * INTO v_sched FROM schedules WHERE id = _schedule_id;
  IF v_sched IS NULL OR v_sched.trainer_registry_id <> v_tr THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;
  IF v_sched.status NOT IN ('LIVE','ACTIVE') THEN
    RAISE EXCEPTION 'Session not live (status=%)', v_sched.status;
  END IF;

  v_session_start := (v_sched.date::text||' '||v_sched.start_time::text)::timestamptz;
  v_session_end   := (v_sched.date::text||' '||v_sched.end_time::text)::timestamptz;
  -- Attendance window = last 10 minutes of the session (+ 5 min grace after end).
  IF now() < v_session_end - interval '10 minutes' OR now() > v_session_end + interval '5 minutes' THEN
    RAISE EXCEPTION 'Outside attendance window (last 10 minutes of session)';
  END IF;

  SELECT geofence_enabled INTO v_geo_enabled FROM global_config LIMIT 1;
  SELECT COALESCE(bypass_geofence,false) INTO v_bypass FROM profiles WHERE id = auth.uid();

  SELECT * INTO v_venue FROM venues WHERE id = v_sched.venue_id;
  v_radius := GREATEST(COALESCE(v_venue.geo_radius, 200), 200);

  IF COALESCE(v_geo_enabled,true) AND NOT v_bypass AND v_venue.latitude IS NOT NULL AND _latitude IS NOT NULL THEN
    v_distance := 6371000 * acos(LEAST(1,
      cos(radians(v_venue.latitude))*cos(radians(_latitude))
      *cos(radians(_longitude)-radians(v_venue.longitude))
      + sin(radians(v_venue.latitude))*sin(radians(_latitude))));
    IF v_distance > v_radius THEN
      RAISE EXCEPTION 'Outside venue geo-fence (% m > % m)', round(v_distance), v_radius;
    END IF;
  END IF;

  UPDATE schedules
    SET checkin_at = now(),
        status = CASE WHEN status = 'LIVE' THEN 'ACTIVE'::schedule_status ELSE status END
    WHERE id = _schedule_id;

  INSERT INTO session_logs (schedule_id, session_status, checkin_latitude, checkin_longitude, geo_verified, submitted_at)
  VALUES (_schedule_id, 'LIVE', _latitude, _longitude, true, now())
  ON CONFLICT (schedule_id) DO UPDATE
    SET checkin_latitude = EXCLUDED.checkin_latitude,
        checkin_longitude = EXCLUDED.checkin_longitude,
        geo_verified = true;

  RETURN jsonb_build_object(
    'checkin_at', now(),
    'roster_unlock_until', now() + interval '50 minutes',
    'distance_m', v_distance
  );
END $function$;

CREATE OR REPLACE FUNCTION public.trainer_end_session(_schedule_id uuid, _learning_outcome text, _lesson_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_tr uuid;
BEGIN
  IF _learning_outcome IS NULL OR length(trim(_learning_outcome)) < 5 THEN
    RAISE EXCEPTION 'Learning outcome is required';
  END IF;
  IF _lesson_plan IS NULL OR length(trim(_lesson_plan)) < 5 THEN
    RAISE EXCEPTION 'Lesson plan is required';
  END IF;
  SELECT trainer_registry_id INTO v_tr FROM profiles WHERE id = auth.uid();
  IF NOT EXISTS (SELECT 1 FROM schedules WHERE id = _schedule_id AND trainer_registry_id = v_tr) THEN
    RAISE EXCEPTION 'Not your schedule';
  END IF;

  INSERT INTO session_logs (schedule_id, lesson_plan, learning_outcome, session_status, submitted_at)
  VALUES (_schedule_id, _lesson_plan, _learning_outcome, 'COMPLETED', now())
  ON CONFLICT (schedule_id) DO UPDATE
    SET lesson_plan = EXCLUDED.lesson_plan,
        learning_outcome = EXCLUDED.learning_outcome,
        session_status = 'COMPLETED',
        submitted_at = now();

  UPDATE schedules
    SET status = 'ENDED'::schedule_status,
        ended_at = now(),
        attendance_locked_at = now()
    WHERE id = _schedule_id;

  UPDATE trainer_registry SET sessions_completed = sessions_completed + 1 WHERE id = v_tr;

  RETURN jsonb_build_object('ok', true, 'ended_at', now());
END $function$;

CREATE OR REPLACE FUNCTION public.wipe_entire_system()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  IF NOT public.has_role(v_actor, 'MA'::app_role) THEN
    RAISE EXCEPTION 'Master Admin only';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_actor;

  -- Truncate academic + operational data first (FK-safe via CASCADE)
  TRUNCATE TABLE
    public.attendance_overrides,
    public.attendance_logs,
    public.session_logs,
    public.pending_sync,
    public.schedule_feedback_messages,
    public.schedule_feedback_threads,
    public.approval_queue,
    public.schedules,
    public.semester_registry,
    public.students,
    public.trainer_skills,
    public.modules,
    public.leave_requests,
    public.notifications,
    public.sections,
    public.levels,
    public.venues,
    public.trainer_registry,
    public.department_heads,
    public.audit_logs
  RESTART IDENTITY CASCADE;

  -- Remove all user_roles except the calling MA
  DELETE FROM public.user_roles WHERE user_id <> v_actor;

  -- Remove all profiles except the calling MA
  DELETE FROM public.profiles WHERE id <> v_actor;

  -- Wipe departments after department_heads is gone
  DELETE FROM public.departments;

  -- Write final audit row (audit_logs was truncated above)
  INSERT INTO public.audit_logs(actor_id, action_type, entity_type, entity_id, after_state)
  VALUES (v_actor, 'WIPE_ENTIRE_SYSTEM', 'system', 'system',
          jsonb_build_object('actor_email', v_email, 'at', now()));

  RETURN jsonb_build_object('ok', true, 'kept_user', v_actor);
END;
$function$;


-- ============ 8. TRIGGERS ============

CREATE TRIGGER trg_enforce_attendance_lock BEFORE INSERT OR UPDATE ON public.attendance_overrides FOR EACH ROW EXECUTE FUNCTION enforce_attendance_lock();
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
CREATE TRIGGER trg_seed_levels AFTER INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION seed_department_levels();
CREATE TRIGGER update_external_contacts_updated_at BEFORE UPDATE ON public.external_contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at_ts();
CREATE TRIGGER prevent_profile_privilege_escalation_trg BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_privilege_escalation();
CREATE TRIGGER schedule_plans_set_updated_at BEFORE UPDATE ON public.schedule_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at_ts();
CREATE TRIGGER trg_enforce_schedule_transition BEFORE UPDATE OF status ON public.schedules FOR EACH ROW EXECUTE FUNCTION enforce_schedule_transition();
CREATE TRIGGER update_sms_campaigns_updated_at BEFORE UPDATE ON public.sms_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at_ts();
CREATE TRIGGER set_sms_settings_updated_at BEFORE UPDATE ON public.sms_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at_ts();
CREATE TRIGGER trg_sync_trainer_primary_dept AFTER INSERT OR UPDATE ON public.trainer_departments FOR EACH ROW EXECUTE FUNCTION sync_trainer_primary_department();


-- ============ 9. STORAGE ============

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars MA all" ON storage.objects FOR ALL TO authenticated
  USING (((bucket_id = 'avatars'::text) AND has_role(auth.uid(), 'MA'::app_role)))
  WITH CHECK (((bucket_id = 'avatars'::text) AND has_role(auth.uid(), 'MA'::app_role)));
CREATE POLICY "avatars pending insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = 'pending'::text) AND (split_part(name, '/'::text, 2) = (auth.uid())::text)));
CREATE POLICY "avatars read authenticated" ON storage.objects FOR SELECT TO authenticated
  USING ((bucket_id = 'avatars'::text));
CREATE POLICY "avatars self delete" ON storage.objects FOR DELETE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "avatars self insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));
CREATE POLICY "avatars self update" ON storage.objects FOR UPDATE TO authenticated
  USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


-- ============ 10. REALTIME PUBLICATION ============

ALTER TABLE public.approval_queue REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_logs REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.leave_requests REPLICA IDENTITY FULL;
ALTER TABLE public.modules REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_feedback_messages REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_feedback_threads REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_plans REPLICA IDENTITY FULL;
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER TABLE public.semester_registry REPLICA IDENTITY FULL;
ALTER TABLE public.session_logs REPLICA IDENTITY FULL;
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.trainer_registry REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_queue, public.attendance_logs, public.attendance_overrides, public.audit_logs, public.leave_requests, public.modules, public.notifications, public.schedule_feedback_messages, public.schedule_feedback_threads, public.schedule_plans, public.schedules, public.semester_registry, public.session_logs, public.students, public.trainer_registry;
