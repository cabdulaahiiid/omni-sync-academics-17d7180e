-- Helper: who may manage cooperative-training master data
CREATE OR REPLACE FUNCTION public.ct_can_manage_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'MA'::app_role)
      OR public.has_role(auth.uid(),'DH'::app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.ct_can_manage_master() FROM anon;

CREATE TABLE public.ct_occupations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_occupations_dept_idx ON public.ct_occupations(department_id);
CREATE INDEX ct_occupations_active_idx ON public.ct_occupations(active);

CREATE TABLE public.ct_curriculum_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  effective_from date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occupation_id, version_label)
);
CREATE INDEX ct_curriculum_versions_occ_idx ON public.ct_curriculum_versions(occupation_id);

CREATE TABLE public.ct_training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE CASCADE,
  curriculum_version_id uuid REFERENCES public.ct_curriculum_versions(id) ON DELETE SET NULL,
  level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL,
  erp_module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occupation_id, name)
);
CREATE INDEX ct_training_modules_occ_idx ON public.ct_training_modules(occupation_id);
CREATE INDEX ct_training_modules_level_idx ON public.ct_training_modules(level_id);

CREATE TABLE public.ct_units_of_competence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_module_id uuid NOT NULL REFERENCES public.ct_training_modules(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_module_id, name)
);
CREATE INDEX ct_uc_module_idx ON public.ct_units_of_competence(training_module_id);

CREATE TABLE public.ct_training_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uc_id uuid NOT NULL REFERENCES public.ct_units_of_competence(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uc_id, name)
);
CREATE INDEX ct_tasks_uc_idx ON public.ct_training_tasks(uc_id);

CREATE TABLE public.ct_enterprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  sector text,
  address text,
  phone text,
  email text,
  latitude numeric,
  longitude numeric,
  allowed_radius_meters numeric NOT NULL DEFAULT 200,
  max_capacity integer NOT NULL DEFAULT 0 CHECK (max_capacity >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_enterprises_active_idx ON public.ct_enterprises(active);

CREATE TABLE public.ct_enterprise_occupations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.ct_enterprises(id) ON DELETE CASCADE,
  occupation_id uuid NOT NULL REFERENCES public.ct_occupations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enterprise_id, occupation_id)
);

CREATE TABLE public.ct_enterprise_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.ct_enterprises(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  role_title text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ct_contacts_ent_idx ON public.ct_enterprise_contacts(enterprise_id);
CREATE INDEX ct_contacts_user_idx ON public.ct_enterprise_contacts(user_id);

CREATE TABLE public.ct_enterprise_training_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id uuid NOT NULL REFERENCES public.ct_enterprises(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  rehabilitation_work text,
  senior_engineer text,
  latitude numeric,
  longitude numeric,
  allowed_radius_meters numeric,
  max_capacity integer,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enterprise_id, name)
);
CREATE INDEX ct_sites_ent_idx ON public.ct_enterprise_training_sites(enterprise_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ct_occupations, public.ct_curriculum_versions,
  public.ct_training_modules, public.ct_units_of_competence, public.ct_training_tasks,
  public.ct_enterprises, public.ct_enterprise_occupations, public.ct_enterprise_contacts,
  public.ct_enterprise_training_sites TO authenticated;
GRANT ALL ON public.ct_occupations, public.ct_curriculum_versions,
  public.ct_training_modules, public.ct_units_of_competence, public.ct_training_tasks,
  public.ct_enterprises, public.ct_enterprise_occupations, public.ct_enterprise_contacts,
  public.ct_enterprise_training_sites TO service_role;

-- RLS: read for signed-in users, write for MA/DH
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ct_occupations','ct_curriculum_versions','ct_training_modules',
    'ct_units_of_competence','ct_training_tasks','ct_enterprises','ct_enterprise_occupations',
    'ct_enterprise_contacts','ct_enterprise_training_sites']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.ct_can_manage_master()) WITH CHECK (public.ct_can_manage_master())', t||'_write', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ts()', t||'_updated_at', t);
  END LOOP;
END $$;

-- ============ SEED: curriculum from the trainee logbook ============
INSERT INTO public.ct_occupations (code, name) VALUES
  ('BEI','Building Electric Installation'),
  ('SIW','Sanitary Installation Work'),
  ('FCW','Finishing Construction Work'),
  ('ALW','Aluminum Works');

INSERT INTO public.ct_curriculum_versions (occupation_id, version_label, effective_from)
SELECT id, 'v1', CURRENT_DATE FROM public.ct_occupations;

INSERT INTO public.ct_training_modules (occupation_id, curriculum_version_id, code, name, sequence)
SELECT o.id, v.id, o.code||'-M1', o.name||' — Practical Training', 1
  FROM public.ct_occupations o
  JOIN public.ct_curriculum_versions v ON v.occupation_id = o.id;

-- Units of competence
INSERT INTO public.ct_units_of_competence (training_module_id, code, name, sequence)
SELECT m.id, x.code, x.name, x.seq
FROM public.ct_training_modules m
JOIN public.ct_occupations o ON o.id = m.occupation_id
JOIN (VALUES
  ('BEI','UNIT I','Install PVC conduit and wiring system',1),
  ('BEI','UNIT II','Read and Interpret Plans and Specifications',2),
  ('BEI','UNIT III','Prepare Working Drawing (CAD)',3),
  ('BEI','UNIT IV','Design Effective and Efficient Lighting for Residential and Commercial Buildings',4),
  ('SIW','SIW-U1','Install water pump sets',1),
  ('SIW','SIW-U2','Weld plastic pipe using fusion method',2),
  ('SIW','SIW-U3','Install and fit off sanitary fixture',3),
  ('SIW','SIW-U4','Install and Adjust Water Service Control and Devices',4),
  ('SIW','SIW-U5','Install service and maintain Fire Hydrant and Hose Reel',5),
  ('FCW','FCW-U1','Carry out mosaic and decorative tiling',1),
  ('FCW','FCW-U2','Apply decorative and texture coat paint finishing',2),
  ('FCW','FCW-U3','Fix wall and floor tiles',3),
  ('FCW','FCW-U4','Apply and Install Plastering Fibrous Components and rendering works',4),
  ('ALW','ALW-U1','Aluminum sections design for specific applications',1),
  ('ALW','ALW-U2','Identify types of aluminum sections & their application area',2),
  ('ALW','ALW-U3','Preparing work area, materials, tools and equipment',3),
  ('ALW','ALW-U4','Joining aluminium sections',4),
  ('ALW','ALW-U5','Assembling aluminum joinery',5)
) AS x(occ, code, name, seq) ON x.occ = o.code;

-- Tasks
INSERT INTO public.ct_training_tasks (uc_id, name, sequence)
SELECT u.id, t.name, t.seq
FROM public.ct_units_of_competence u
JOIN public.ct_training_modules m ON m.id = u.training_module_id
JOIN public.ct_occupations o ON o.id = m.occupation_id
JOIN (VALUES
  ('BEI','Install PVC conduit and wiring system','Planning and preparing tools and equipment',1),
  ('BEI','Install PVC conduit and wiring system','Installing wiring system',2),
  ('BEI','Install PVC conduit and wiring system','Inspecting and notifying completion of work',3),
  ('BEI','Read and Interpret Plans and Specifications','Identifying types of drawings and their functions',1),
  ('BEI','Read and Interpret Plans and Specifications','Recognising amendments',2),
  ('BEI','Read and Interpret Plans and Specifications','Recognising commonly used symbols and abbreviations',3),
  ('BEI','Read and Interpret Plans and Specifications','Locating and identifying key features on a site plan',4),
  ('BEI','Read and Interpret Plans and Specifications','Identifying project requirements',5),
  ('BEI','Read and Interpret Plans and Specifications','Reading and interpreting job specifications',6),
  ('BEI','Prepare Working Drawing (CAD)','Determining drawing requirements',1),
  ('BEI','Prepare Working Drawing (CAD)','Producing drawings in third angle projection, including auxiliary views, sections and assemblies',2),
  ('BEI','Prepare Working Drawing (CAD)','Issuing and/or filing drawing',3),
  ('BEI','Design Effective and Efficient Lighting for Residential and Commercial Buildings','Preparing to design lighting',1),
  ('BEI','Design Effective and Efficient Lighting for Residential and Commercial Buildings','Developing lighting design',2),
  ('ALW','Aluminum sections design for specific applications','Architectural Systems',1),
  ('ALW','Aluminum sections design for specific applications','Residential Systems',2),
  ('ALW','Aluminum sections design for specific applications','Partitions',3),
  ('ALW','Aluminum sections design for specific applications','Security Systems',4),
  ('ALW','Aluminum sections design for specific applications','Geometric Shapes',5),
  ('ALW','Identify types of aluminum sections & their application area','Commercial fabrication',1),
  ('ALW','Identify types of aluminum sections & their application area','Residential fabrication',2),
  ('ALW','Preparing work area, materials, tools and equipment','Identifying necessary tools and equipment',1),
  ('ALW','Preparing work area, materials, tools and equipment','Use of different types of aluminium sections',2),
  ('ALW','Preparing work area, materials, tools and equipment','Selecting the right equipment',3),
  ('ALW','Joining aluminium sections','Operating equipment',1),
  ('ALW','Joining aluminium sections','Drilling holes',2),
  ('ALW','Joining aluminium sections','Cutting to length',3),
  ('ALW','Joining aluminium sections','Punching holes',4),
  ('ALW','Joining aluminium sections','Cutting for joint',5),
  ('ALW','Joining aluminium sections','Trimming for fit',6),
  ('ALW','Assembling aluminum joinery','Fitting seals',1),
  ('ALW','Assembling aluminum joinery','Selecting and fitting hardware',2),
  ('ALW','Assembling aluminum joinery','Mitre joints',3),
  ('ALW','Assembling aluminum joinery','Serrated stakes',4),
  ('ALW','Assembling aluminum joinery','Pop rivets',5),
  ('ALW','Assembling aluminum joinery','Dimpling',6),
  ('ALW','Assembling aluminum joinery','Screws',7),
  ('ALW','Assembling aluminum joinery','Socket joint',8),
  ('ALW','Assembling aluminum joinery','Mortise and tenon',9),
  ('ALW','Assembling aluminum joinery','Snap-in assembly',10)
) AS t(occ, uc, name, seq) ON t.occ = o.code AND t.uc = u.name;