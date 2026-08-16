DO $$
DECLARE
  ict uuid := '684d1b98-5a92-497f-a78d-e68892997cc9';
  eng uuid := '70221b4e-6cdf-494e-8273-8172b6389c8f';
  sem uuid;
  lvl RECORD; m RECORD; s RECORD; sc RECORD; st RECORD;
  v_lab1 uuid; v_lab2 uuid; v_room1 uuid; v_room2 uuid;
  wk int; d date; idx int := 0; tr uuid; ven uuid; sec_id uuid;
  base_date date := (current_date - interval '63 days')::date;
  stat schedule_status; pres boolean; log_id uuid; nsec int;
BEGIN
  -- Venues
  SELECT id INTO v_lab1 FROM public.venues WHERE name='Lab 1' LIMIT 1;
  SELECT id INTO v_lab2 FROM public.venues WHERE name='Lab 2' LIMIT 1;
  SELECT id INTO v_room1 FROM public.venues WHERE name='Room 1' LIMIT 1;
  SELECT id INTO v_room2 FROM public.venues WHERE name='Room 2' LIMIT 1;
  IF v_lab1 IS NULL THEN
    INSERT INTO public.venues(name,type,latitude,longitude,geo_radius,capacity)
    VALUES ('Lab 1','Lab',9.0300,38.7400,80,40) RETURNING id INTO v_lab1;
  END IF;
  IF v_lab2 IS NULL THEN
    INSERT INTO public.venues(name,type,latitude,longitude,geo_radius,capacity)
    VALUES ('Lab 2','Lab',9.0302,38.7404,80,35) RETURNING id INTO v_lab2;
  END IF;
  IF v_room1 IS NULL THEN
    INSERT INTO public.venues(name,type,latitude,longitude,geo_radius,capacity)
    VALUES ('Room 1','Classroom',9.0305,38.7409,80,50) RETURNING id INTO v_room1;
  END IF;
  IF v_room2 IS NULL THEN
    INSERT INTO public.venues(name,type,latitude,longitude,geo_radius,capacity)
    VALUES ('Room 2','Classroom',9.0307,38.7412,80,50) RETURNING id INTO v_room2;
  END IF;
  INSERT INTO public.venues(name,type,latitude,longitude,geo_radius,capacity)
  SELECT 'Workshop A','Workshop',9.0310,38.7420,90,25
  WHERE NOT EXISTS (SELECT 1 FROM public.venues WHERE name='Workshop A');

  -- Sections A/B for ICT + Engineering levels I..IV
  FOR lvl IN SELECT id, department_id FROM public.levels
             WHERE department_id IN (ict,eng) AND name IN ('I','II','III','IV') LOOP
    INSERT INTO public.sections(level_id,name,department_id)
    SELECT lvl.id, x.n, lvl.department_id FROM (VALUES ('A'),('B')) x(n)
    WHERE NOT EXISTS (SELECT 1 FROM public.sections s2 WHERE s2.level_id=lvl.id AND s2.name=x.n);
  END LOOP;

  -- Modules
  INSERT INTO public.modules(code,name,level_id,type,qualifications,department_id,total_hours,total_sessions,status)
  SELECT x.code, x.mname, l.id, x.mtype::module_type, ARRAY[x.code], ict, x.hrs, x.sess, 'ACTIVE'
  FROM (VALUES
    ('ICT-101','Introduction to Computing','I','Theory',60,30),
    ('ICT-102','Computer Networks Fundamentals','I','Both',90,45),
    ('ICT-201','Database Systems','II','Both',80,40),
    ('ICT-202','Web Application Development','II','Practical',96,48),
    ('ICT-301','Network Administration','III','Practical',100,50),
    ('ICT-401','IT Project Management','IV','Theory',72,36)
  ) AS x(code,mname,lname,mtype,hrs,sess)
  JOIN public.levels l ON l.department_id=ict AND l.name::text=x.lname
  WHERE NOT EXISTS (SELECT 1 FROM public.modules mm WHERE mm.code=x.code);

  INSERT INTO public.modules(code,name,level_id,type,qualifications,department_id,total_hours,total_sessions,status)
  SELECT x.code, x.mname, l.id, x.mtype::module_type, ARRAY[x.code], eng, x.hrs, x.sess, 'ACTIVE'
  FROM (VALUES
    ('ENG-101','Engineering Drawing','I','Practical',80,40),
    ('ENG-102','Applied Mathematics','I','Theory',64,32),
    ('ENG-201','Electrical Installation','II','Both',96,48),
    ('ENG-301','Machine Maintenance','III','Practical',100,50)
  ) AS x(code,mname,lname,mtype,hrs,sess)
  JOIN public.levels l ON l.department_id=eng AND l.name::text=x.lname
  WHERE NOT EXISTS (SELECT 1 FROM public.modules mm WHERE mm.code=x.code);

  -- Trainers
  INSERT INTO public.trainer_registry(full_name,hidden_staff_id,email,phone,qualifications,department_id,status,sessions_target,sessions_completed)
  SELECT x.fname, gen_random_uuid(), x.email, x.phone, x.q, CASE WHEN x.dep='ICT' THEN ict ELSE eng END, 'ACTIVE', x.tgt, x.done
  FROM (VALUES
    ('Selam Bekele','selam.bekele@demo.tvet.et','0911200101',ARRAY['ICT-101','ICT-102'],'ICT',40,31),
    ('Yonas Tesfaye','yonas.tesfaye@demo.tvet.et','0911200102',ARRAY['ICT-201','ICT-202'],'ICT',40,36),
    ('Hanna Girma','hanna.girma@demo.tvet.et','0911200103',ARRAY['ICT-301'],'ICT',36,28),
    ('Dawit Alemu','dawit.alemu@demo.tvet.et','0911200104',ARRAY['ICT-401','ICT-201'],'ICT',32,30),
    ('Meron Tadesse','meron.tadesse@demo.tvet.et','0911200105',ARRAY['ICT-102','ICT-202'],'ICT',38,22),
    ('Abel Kebede','abel.kebede@demo.tvet.et','0911200106',ARRAY['ENG-101','ENG-102'],'ENG',40,34),
    ('Lily Haile','lily.haile@demo.tvet.et','0911200107',ARRAY['ENG-201'],'ENG',36,29),
    ('Samuel Negash','samuel.negash@demo.tvet.et','0911200108',ARRAY['ENG-301'],'ENG',34,20)
  ) AS x(fname,email,phone,q,dep,tgt,done)
  WHERE NOT EXISTS (SELECT 1 FROM public.trainer_registry t WHERE t.email=x.email);

  INSERT INTO public.trainer_departments(trainer_registry_id,department_id,is_primary)
  SELECT t.id, t.department_id, true FROM public.trainer_registry t
  WHERE t.email LIKE '%@demo.tvet.et'
    AND NOT EXISTS (SELECT 1 FROM public.trainer_departments td WHERE td.trainer_registry_id=t.id AND td.department_id=t.department_id);

  -- Students: 15 per section for ICT + Engineering levels I..III
  idx := 0;
  FOR s IN SELECT sec.id sid, sec.level_id, sec.department_id, sec.name sname
           FROM public.sections sec JOIN public.levels l ON l.id=sec.level_id
           WHERE sec.department_id IN (ict,eng) AND l.name IN ('I','II','III')
           ORDER BY sec.department_id, l.name, sec.name LOOP
    FOR nsec IN 1..15 LOOP
      idx := idx + 1;
      INSERT INTO public.students(registration_number,full_name,gender,telephone,level_id,section_id,department_id,status,
                                  parent_guardian_name,parent_guardian_telephone,parent_guardian_relationship)
      SELECT 'TVET-2026-' || lpad(idx::text,4,'0'),
             (ARRAY['Abel','Bethel','Chala','Dagim','Eden','Fikir','Genet','Hiwot','Kalkidan','Liya','Mikias','Nardos','Robel','Sara','Tewodros'])[((idx-1)%15)+1]
               || ' ' || (ARRAY['Alemu','Bekele','Chane','Desta','Ephrem','Girma','Haile','Kebede','Lemma','Mekonnen'])[((idx-1)%10)+1],
             CASE WHEN idx % 2 = 0 THEN 'F' ELSE 'M' END,
             '09' || lpad((21000000 + idx)::text,8,'0'),
             s.level_id, s.sid, s.department_id, 'ACTIVE',
             (ARRAY['Ato Bekele','W/ro Aster','Ato Girma','W/ro Tigist','Ato Mulugeta'])[((idx-1)%5)+1] || ' Guardian',
             '09' || lpad((31000000 + idx)::text,8,'0'),
             (ARRAY['Father','Mother','Uncle','Aunt','Guardian'])[((idx-1)%5)+1]
      WHERE NOT EXISTS (SELECT 1 FROM public.students st2 WHERE st2.registration_number='TVET-2026-'||lpad(idx::text,4,'0'));
    END LOOP;
  END LOOP;

  -- Semester
  SELECT id INTO sem FROM public.semester_registry WHERE name='Demo Academic Year 2026' LIMIT 1;
  IF sem IS NULL THEN
    INSERT INTO public.semester_registry(name,start_date,end_date,status,distribution_status)
    VALUES ('Demo Academic Year 2026', base_date, (base_date + interval '120 days')::date, 'LIVE','PUBLISHED')
    RETURNING id INTO sem;
  END IF;

  -- Schedules: 10 weeks x modules
  FOR wk IN 1..10 LOOP
    idx := 0;
    FOR m IN SELECT mo.id, mo.code, mo.name, mo.level_id, mo.department_id
             FROM public.modules mo WHERE mo.department_id IN (ict,eng)
               AND (mo.code LIKE 'ICT-%' OR mo.code LIKE 'ENG-%')
             ORDER BY mo.code LOOP
      idx := idx + 1;
      SELECT sec.id INTO sec_id FROM public.sections sec WHERE sec.level_id=m.level_id AND sec.name='A' LIMIT 1;
      CONTINUE WHEN sec_id IS NULL;
      SELECT t.id INTO tr FROM public.trainer_registry t
        WHERE t.department_id=m.department_id AND t.email LIKE '%@demo.tvet.et'
        ORDER BY t.full_name OFFSET ((idx-1) % 3) LIMIT 1;
      CONTINUE WHEN tr IS NULL;
      ven := CASE (idx % 4) WHEN 0 THEN v_lab1 WHEN 1 THEN v_lab2 WHEN 2 THEN v_room1 ELSE v_room2 END;
      d := base_date + ((wk-1)*7 + ((idx-1) % 5));
      stat := CASE
        WHEN d < current_date - 1 THEN 'COMPLETED'
        WHEN d = current_date THEN 'ACTIVE'
        WHEN d <= current_date + 7 THEN 'PENDING_MA'
        ELSE 'DRAFT' END;
      INSERT INTO public.schedules(semester_id,week_num,date,day,trainer_name,hidden_staff_id,trainer_registry_id,
        module_code,module_name,level_id,section_id,venue_id,start_time,end_time,department_id,status,mode,is_published,published_at)
      SELECT sem, wk, d,
        upper(to_char(d,'DY')),
        t.full_name, t.hidden_staff_id, t.id, m.code, m.name, m.level_id, sec_id, ven,
        (time '08:00' + ((idx % 4) * interval '90 minutes')),
        (time '08:00' + ((idx % 4) * interval '90 minutes') + interval '90 minutes'),
        m.department_id, stat, 'Both', stat <> 'DRAFT',
        CASE WHEN stat <> 'DRAFT' THEN now() ELSE NULL END
      FROM public.trainer_registry t WHERE t.id=tr
      AND NOT EXISTS (
        SELECT 1 FROM public.schedules x WHERE x.semester_id=sem AND x.week_num=wk AND x.module_code=m.code
      );
    END LOOP;
  END LOOP;
END $$;