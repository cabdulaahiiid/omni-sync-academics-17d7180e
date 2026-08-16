DO $$
DECLARE
  sc RECORD; st RECORD; i int := 0; pres boolean;
BEGIN
  FOR sc IN SELECT s.* FROM public.schedules s
            JOIN public.semester_registry sr ON sr.id=s.semester_id
            WHERE sr.name='Demo Academic Year 2026' AND s.status='COMPLETED' LOOP
    UPDATE public.schedules
      SET checkin_at = (sc.date + sc.start_time)::timestamptz,
          ended_at = (sc.date + sc.end_time)::timestamptz,
          attendance_locked_at = (sc.date + sc.end_time)::timestamptz
      WHERE id = sc.id AND checkin_at IS NULL;

    IF NOT EXISTS (SELECT 1 FROM public.session_logs sl WHERE sl.schedule_id=sc.id) THEN
      INSERT INTO public.session_logs(schedule_id,learning_outcome,lesson_plan,geo_verified,
        checkin_latitude,checkin_longitude,session_status,submitted_at)
      VALUES (sc.id,
        'Learners can explain and apply the key concepts of ' || sc.module_name || '.',
        'Warm-up review, guided demonstration, supervised practical task, and closing assessment for ' || sc.module_name || '.',
        true, 9.0300, 38.7400, 'COMPLETED', (sc.date + sc.end_time)::timestamptz);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.attendance_logs al WHERE al.schedule_id=sc.id) THEN
      FOR st IN SELECT id FROM public.students WHERE section_id=sc.section_id ORDER BY registration_number LOOP
        i := i + 1;
        pres := (i % 9) <> 0;
        INSERT INTO public.attendance_logs(schedule_id,student_id,present,attendance_timestamp)
        VALUES (sc.id, st.id, pres, (sc.date + sc.end_time)::timestamptz);
      END LOOP;
    END IF;
  END LOOP;

  -- Approvals (session level)
  INSERT INTO public.approval_queue(schedule_id,type,target_id,decision,conflict_trainer,conflict_venue,excessive_load,invalid_qualification,comment)
  SELECT s.id,'session',s.id,
    CASE WHEN row_number() OVER (ORDER BY s.date) % 3 = 0 THEN 'approved'::approval_decision
         WHEN row_number() OVER (ORDER BY s.date) % 7 = 0 THEN 'rejected'::approval_decision
         ELSE 'pending'::approval_decision END,
    false,false,false,false,
    'Demo approval request for ' || s.module_code
  FROM public.schedules s
  JOIN public.semester_registry sr ON sr.id=s.semester_id
  WHERE sr.name='Demo Academic Year 2026' AND s.status='PENDING_MA'
    AND NOT EXISTS (SELECT 1 FROM public.approval_queue a WHERE a.schedule_id=s.id);

  UPDATE public.approval_queue SET decided_at = now() - interval '2 days'
   WHERE decision <> 'pending' AND decided_at IS NULL;

  -- Activity history
  INSERT INTO public.audit_logs(action_type,entity_type,entity_id,after_state,timestamp)
  SELECT x.a, x.e, NULL, jsonb_build_object('note', x.n), now() - (x.d || ' hours')::interval
  FROM (VALUES
    ('LOGIN','auth','Demo master admin signed in','2'),
    ('LOGIN','auth','Demo department head signed in','5'),
    ('BULK_IMPORT','students','180 demo students imported','30'),
    ('BULK_IMPORT','modules','10 demo modules imported','32'),
    ('CREATE','schedules','Demo weekly timetable generated','28'),
    ('APPROVE','approval_queue','Week 3 timetable approved','20'),
    ('REJECT','approval_queue','Week 5 timetable returned for feedback','18'),
    ('RUN_REPORT','reports','Attendance summary exported','6'),
    ('ADMIN_PASSWORD_RESET','profiles','Demo trainer password reset','12'),
    ('SUSPEND','profiles','Demo account suspended for review','48')
  ) AS x(a,e,n,d)
  WHERE NOT EXISTS (SELECT 1 FROM public.audit_logs al WHERE al.after_state->>'note' = x.n);
END $$;