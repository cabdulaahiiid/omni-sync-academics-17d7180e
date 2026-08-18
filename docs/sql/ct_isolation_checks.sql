-- Automated cross-department isolation checks for Cooperative & Industrial
-- Practical Training. Run as a superuser/service connection; each block
-- impersonates a real user and asserts what that user may read.
--
--   psql "$DATABASE_URL" -f docs/sql/ct_isolation_checks.sql
--
-- Any RAISE EXCEPTION below means RLS has regressed.

do $$
declare
  v_ind_dh uuid;
  v_other_dh uuid;
  v_ind_dept uuid;
  n int;
begin
  select p.id, p.department_id into v_ind_dh, v_ind_dept
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'DH'
  join public.departments d on d.id = p.department_id
  where upper(d.name) like '%INDUSTRIAL%'
  limit 1;

  select p.id into v_other_dh
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id and ur.role = 'DH'
  join public.departments d on d.id = p.department_id
  where upper(d.name) not like '%INDUSTRIAL%'
  limit 1;

  if v_ind_dh is null or v_other_dh is null then
    raise notice 'Skipping: need one industrial and one non-industrial department head.';
    return;
  end if;

  -- 1. A non-industrial DH must not see industrial requests.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_other_dh, 'role', 'authenticated')::text, true);
  select count(*) into n from public.ct_training_requests where department_id = v_ind_dept;
  if n > 0 then raise exception 'Isolation failure: other DH sees % industrial requests', n; end if;

  select count(*) into n from public.ct_student_placements where department_id = v_ind_dept;
  if n > 0 then raise exception 'Isolation failure: other DH sees % industrial placements', n; end if;

  select count(*) into n
  from public.ct_request_decisions dcs
  join public.ct_training_requests r on r.id = dcs.request_id
  where r.department_id = v_ind_dept;
  if n > 0 then raise exception 'Isolation failure: other DH sees % industrial approval records', n; end if;

  -- 2. Only the industrial DH holds practical-training authority.
  if public.ct_is_industrial_dh() then
    raise exception 'Isolation failure: non-industrial DH reported as industrial DH';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_ind_dh, 'role', 'authenticated')::text, true);
  if not public.ct_is_industrial_dh() then
    raise exception 'Isolation failure: industrial DH not recognised';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'Cooperative training isolation checks passed.';
end $$;
