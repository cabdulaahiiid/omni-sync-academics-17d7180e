
# TVET OMNI-SYNC ERP — Foundation v1

Scope: Backend foundation, role-based auth (MA/DH/T), and the **Master Admin portal** with CRUD for all master data. Scheduling engine, trainer PWA, attendance, and approvals come in later phases.

---

## 1. Backend (Lovable Cloud / Postgres)

Enable Lovable Cloud and create all 20 tables from your spec, mapped from Firestore to Postgres:
- `AutoID` → `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `Reference(X)` → FK with `ON DELETE` rules
- `Enum(...)` → Postgres `ENUM` types
- `JSON` → `jsonb`
- `Array` → `text[]`
- `Timestamp` → `timestamptz DEFAULT now()`

**Roles** stored in a separate `user_roles` table (NOT on `users`) with an `app_role` enum (`MA`, `DH`, `T`) and a `SECURITY DEFINER has_role()` function — avoids RLS recursion and privilege escalation.

**Hidden trainer ID**: `trainer_registry.hidden_staff_id uuid DEFAULT gen_random_uuid()` — never exposed to DH/Trainer clients via column-level RLS / restricted views.

**Profiles table** linked to `auth.users` with auto-create trigger (`handle_new_user`) populating `full_name`, `email`, default role.

## 2. RLS Policies (every table)

- **MA**: full read/write everywhere via `has_role(auth.uid(), 'MA')`.
- **DH**: read/write only rows where `department_id` matches their `department_heads.department_id`.
- **T**: read only their own schedules / attendance; write only own session logs.
- `audit_logs`, `trainer_registry.hidden_staff_id`: MA-only.
- `global_config`: MA write, all roles read.

## 3. Auth

- Email/password sign-in (Lovable Cloud native).
- Login page → routes user to `/admin`, `/dh`, or `/trainer` based on role.
- `_authenticated` layout + per-role guards (`_admin`, `_dh`, `_trainer`).
- Session listener at root (invalidates queries on auth change).

## 4. Master Admin Portal (built in v1)

Layout matches mockup: dark navy sidebar (logo + profile + nav), top bar with notifications + avatar, content area with colored stat cards.

**Pages:**
- `/admin` — Dashboard: stat cards (Departments, Trainers, Students, Active Schedules), Schedule Change Requests preview, Attendance/Punctuality charts (Recharts).
- `/admin/users` — User Management: create users, assign role (MA/DH/T), link to department / trainer registry.
- `/admin/departments` — CRUD departments + suspend/activate.
- `/admin/department-heads` — Assign DH users to departments.
- `/admin/trainers` — TrainerRegistry CRUD, qualifications, skills (TrainerSkills sub-table), suspend/activate. Hidden staff ID visible only to MA.
- `/admin/levels` — CRUD Levels (I–V) per department.
- `/admin/sections` — CRUD Sections per level.
- `/admin/students` — CRUD Students with level/section/department.
- `/admin/modules` — CRUD Modules with code, type, qualifications, hours/sessions.
- `/admin/venues` — CRUD Venues with lat/lng + geo radius (map-free numeric inputs in v1).
- `/admin/semesters` — SemesterRegistry CRUD with status.
- `/admin/settings` — GlobalConfig (geo-fence radius, attendance window, offline sync toggle).
- `/admin/audit-logs` — Read-only audit log viewer with filter by actor/entity/date.

**Patterns used everywhere:**
- TanStack Query (`ensureQueryData` + `useSuspenseQuery`) backed by `createServerFn` + `requireSupabaseAuth`.
- Shadcn Table, Dialog, Form (react-hook-form + zod), Sonner toasts.
- Audit-log helper called from every mutation server fn (writes `before_state` / `after_state` to `audit_logs`).

## 5. Stub portals (placeholders for next phase)

- `/dh` — empty Department Head shell with sidebar, "Coming next" panel.
- `/trainer` — mobile-optimized shell, "Coming next" panel.

So role-routing works end-to-end now and we just fill these in next.

## 6. Design system

- Navy primary (`oklch` deep blue, ~#1e2a47), white surface, muted slate.
- Stat-card variants: `blue`, `green`, `purple`, `orange` — defined as semantic tokens in `src/styles.css`, never inline classes.
- Inter font, rounded-lg radius, subtle shadows.
- Sidebar: dark navy with white text, primary-tinted active state.

---

## Technical notes

- TanStack Start file-based routes; `_authenticated/_admin.tsx` layout with `beforeLoad` redirect.
- Server fns live in `src/lib/*.functions.ts`; admin-elevated helpers in `*.server.ts`.
- All enums created as Postgres types in the migration.
- Foreign keys use `ON DELETE RESTRICT` for reference data, `CASCADE` only for child rows (e.g. `trainer_skills`).
- `gen_random_uuid()` for hidden_staff_id; never sent to non-MA clients.
- No PWA / offline / geo-check in v1 — those land with the Trainer portal phase.

## Out of scope for v1 (next phases)

1. DH schedule builder + conflict detection engine + approval queue.
2. Trainer PWA with geo-fenced check-in, attendance window enforcement, offline sync.
3. AttendanceOverrides workflow, LeaveRequests workflow, Notifications delivery.
4. Real-time sync subscriptions, analytics dashboards beyond the basic counts.

Approve this and I'll build it.
