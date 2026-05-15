
## Goal

Two tracks:
1. **Fix the recurring `Unauthorized: No authorization header provided` runtime error** so dashboards load reliably.
2. **Complete the role workflows** (MA, DH, Trainer) so the app matches the provided specification — admin can seed departments + DH/Trainer accounts with real credentials, DH can register trainers/students and submit semester schedules, trainers can run sessions on mobile.

---

## Track 1 — Fix the Unauthorized error (root cause)

### Diagnosis
- `src/start.ts` already registers `attachSupabaseAuth` as `functionMiddleware`, and the attacher reads `supabase.auth.getSession()` and sets the `Authorization` header. This is the correct wiring.
- Earlier "fix" passed `{ headers: authHeaders }` as a serverFn argument (e.g. `audit({ headers: authHeaders })`). **`createServerFn` does not accept a `headers` key on the call** — the value is silently dropped. It works only by coincidence when the global middleware also fires.
- The real failure mode: queries fire before the Supabase session has hydrated in the browser, OR a query runs that isn't gated by `authReady && hasSession`.

### Fix
1. **Remove all `{ headers: authHeaders }` arguments** from serverFn invocations across:
   - `src/hooks/use-me.ts`
   - `src/routes/_authenticated/strategic/index.tsx`
   - `src/routes/_authenticated/strategic/departments.tsx`
   - `src/routes/_authenticated/strategic/department-heads.tsx`
   - `src/routes/_authenticated/strategic/modules.tsx`
   Rely on the global `attachSupabaseAuth` middleware (already in `src/start.ts`).
2. **Gate the `_authenticated` layout's `beforeLoad`** with `supabase.auth.getUser()` (already correct) — this guarantees a session before any child loader/component runs.
3. **Keep the `enabled: authReady && hasSession` guard** in `useQuery` for components, but simplify `useAuthSession` to drop the `authHeaders` export.
4. **Add a root-level `onAuthStateChange` listener** in `src/routes/__root.tsx` that calls `queryClient.invalidateQueries()` + `router.invalidate()` so login/logout reflects immediately without stale 401s.

### Verify
- `curl` `/strategic` unauthenticated → 302 to `/login`.
- Sign in as MA → `/strategic` loads, no `_serverFn` 401s in console/network.

---

## Track 2 — Spec compliance (MA, DH, Trainer workflows)

### A. MA — User & Account Provisioning (Workflow 1)
Currently DH "creation" only inserts into `department_heads` (a mapping table); it doesn't create real auth users. Per spec, MA must create DH **and** trainer accounts with email/password.

1. Add server functions in `src/lib/dh.functions.ts` / new `src/lib/users.functions.ts`:
   - `createDepartmentHead({ email, password, fullName, departmentId })` — uses `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`, then inserts into `profiles` (department_id), `user_roles` (role='DH'), and `department_heads`.
   - `createTrainer({ email, password, fullName, departmentId, qualifications })` — admin-creates auth user, inserts `trainer_registry` row, links `profiles.trainer_registry_id`, inserts `user_roles` (role='T').
   - Both protected by `requireSupabaseAuth` + `has_role(MA)` check.
2. Update `/strategic/department-heads` UI to take email + password + name (default password helper button → `Head@123`).
3. Update `/strategic/trainers` UI to a working create form (email + password + name + dept + qualifications); default password helper → `Trainer@123`.

### B. DH — Departmental Setup & Schedule Submission (Workflows 3 & 4)
1. **Operational shell** (`/operational`): build sidebar with Levels & Sections, Trainers, Students, Schedule Management, Live Monitoring, Attendance Disputes.
2. **Levels & Sections page** — CRUD scoped to current DH's department (RLS already enforces).
3. **Trainer Management** — list dept trainers; "Add Trainer" calls `createTrainer` (DH-restricted variant or MA-only — spec says MA creates trainers; we'll keep creation MA-side and let DH only view/assign).
4. **Student bulk upload** — CSV → parse client-side (papaparse) → batch insert into `students` with dept_id auto-set + level_id/section_id resolved from CSV columns.
5. **Semester Schedule generation** — Excel upload (xlsx lib) → temporal slicing engine that:
   - Resolves trainer name → `hidden_staff_id` from `trainer_registry`.
   - Calculates each session date from start date + frequency days + duration.
   - Inserts rows into `schedules` with status='DRAFT'.
   - "Submit for Approval" → bulk update status='PENDING'.
6. **Conflict detection helper** runs server-side before submission (trainer overlap, venue overlap).

### C. MA — Schedule Approval (Workflow 2)
Already partially scaffolded in `/strategic/index.tsx`. Add:
- Detail view per pending schedule with conflict matrix.
- Approve / Send-back actions writing `schedules.status` and `schedules.admin_feedback`.
- Notify DH via `notifications` insert.

### D. Trainer — Mobile Session Workflow (Workflow 7)
1. Build `/ground` shell (mobile-first).
2. Today's schedule list filtered by `trainer_registry_id = current_trainer_registry_id()` and date=today.
3. Session detail: mode toggle (Theory/Practical/Both), 30-minute gatekeeper using `global_config.attendance_window_minutes` + browser geolocation vs venue lat/lng + `geo_fence_radius`.
4. Attendance roster (toggle present/absent per student) → submit to `attendance_logs`.
5. Mandatory LO + Lesson Plan inputs → write to `session_logs`.
6. End Session → status update + completion counter.

### E. Realtime
- Enable `supabase_realtime` publication for `schedules`, `session_logs`, `attendance_logs`, `notifications`.
- Subscribe in DH live-monitoring view.

---

## Technical notes
- Use `supabaseAdmin` (in `src/integrations/supabase/client.server`) only inside MA-gated serverFns for `auth.admin.createUser`.
- All new serverFns live in `*.functions.ts` files (client-importable) with `requireSupabaseAuth` + an MA/DH role check helper (`assertRole(context, 'MA')`).
- Excel parsing via `xlsx` package; CSV via `papaparse`. Add with `bun add` before importing.
- Bootstrap MA: `bootstrap_first_user_as_ma` trigger already exists — first signup becomes MA.

## Sequencing (suggested)
1. Track 1 fix (small, ~6 file edits) — unblocks current build.
2. Track 2A (MA can create real DH + Trainer accounts).
3. Track 2B (DH setup + schedule upload).
4. Track 2C (MA approval workflow polish).
5. Track 2D (Trainer mobile flow).
6. Track 2E (Realtime).

## Out of scope for this iteration
- Offline sync for the trainer app (`global_config.allow_offline_sync` flag exists but not wired).
- Push/email notifications (in-app `notifications` table only).
- Excel template file — user will provide later; we'll use a sensible default schema documented in-app.
