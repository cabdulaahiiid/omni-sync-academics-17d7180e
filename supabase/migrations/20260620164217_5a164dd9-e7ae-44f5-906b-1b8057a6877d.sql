-- trainer_departments link table for multi-department assignments
CREATE TABLE public.trainer_departments (
  trainer_registry_id uuid NOT NULL REFERENCES public.trainer_registry(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trainer_registry_id, department_id)
);

GRANT SELECT ON public.trainer_departments TO authenticated;
GRANT ALL ON public.trainer_departments TO service_role;

ALTER TABLE public.trainer_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "MA full access trainer_departments"
  ON public.trainer_departments FOR ALL
  USING (public.has_role(auth.uid(), 'MA'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'MA'::app_role));

CREATE POLICY "DH/Trainer read trainer_departments"
  ON public.trainer_departments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'MA'::app_role)
    OR (public.has_role(auth.uid(), 'DH'::app_role) AND department_id = public.current_department_id())
    OR trainer_registry_id = public.current_trainer_registry_id()
  );

-- Unique primary per trainer
CREATE UNIQUE INDEX trainer_departments_one_primary
  ON public.trainer_departments(trainer_registry_id) WHERE is_primary = true;

CREATE INDEX trainer_departments_dept_idx ON public.trainer_departments(department_id);

-- Keep primary department in sync with trainer_registry.department_id + profiles.department_id
CREATE OR REPLACE FUNCTION public.sync_trainer_primary_department()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_primary THEN
    UPDATE public.trainer_registry SET department_id = NEW.department_id
      WHERE id = NEW.trainer_registry_id;
    -- mirror to profile
    UPDATE public.profiles SET department_id = NEW.department_id
      WHERE trainer_registry_id = NEW.trainer_registry_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_trainer_primary_dept
  AFTER INSERT OR UPDATE ON public.trainer_departments
  FOR EACH ROW EXECUTE FUNCTION public.sync_trainer_primary_department();

-- Backfill: one primary row per existing trainer using their current dept
INSERT INTO public.trainer_departments (trainer_registry_id, department_id, is_primary)
SELECT id, department_id, true FROM public.trainer_registry WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RPC: replace a user's roles atomically (MA only). Keeps last MA guardrail.
CREATE OR REPLACE FUNCTION public.admin_update_user_roles(_user_id uuid, _roles app_role[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

-- RPC: set a trainer's departments (first id becomes primary).
CREATE OR REPLACE FUNCTION public.admin_set_trainer_departments(_user_id uuid, _department_ids uuid[], _primary_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

-- RPC: set DH's single department
CREATE OR REPLACE FUNCTION public.admin_set_dh_department(_user_id uuid, _department_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;