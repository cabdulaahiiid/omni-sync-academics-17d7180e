## Goal
Extend Users & Roles (MA-only) so an admin can edit a user's role(s), move a trainer between departments, and assign a trainer to multiple departments.

## Scope
- Page: `src/routes/_authenticated/strategic/users.tsx` — add an "Edit roles & departments" section inside the existing Manage dialog.
- New server functions in `src/lib/users-admin.functions.ts`:
  - `updateUserRoles({ user_id, roles: ("MA"|"DH"|"T")[] })` — replace `user_roles` rows; sync `department_heads` when DH role added/removed.
  - `setUserDepartments({ user_id, department_ids: string[] })` — assign one or more departments to a trainer; first id becomes the trainer's primary `profiles.department_id` and `trainer_registry.department_id`; remaining ids stored in a new `trainer_departments` link table.
  - `moveTrainerDepartment({ user_id, new_department_id })` — convenience wrapper that sets primary department.
- DB migration:
  - New `public.trainer_departments(trainer_registry_id uuid, department_id uuid, primary_dept boolean, PK(trainer_registry_id, department_id))` with GRANTs, RLS (MA full, DH read own dept, trainer read self), and a trigger keeping `profiles.department_id` / `trainer_registry.department_id` in sync with the row flagged `primary_dept = true`.
  - Backfill: insert one row per existing trainer using their current `trainer_registry.department_id` as primary.
- `listAllUsers`: include `department_ids: string[]` (all departments for trainers) so the UI can show chips.
- Scheduling/queries that filter trainers by department (e.g. `getBuilderOptions`, DH trainer pickers) updated to use `trainer_departments` so a multi-dept trainer appears in every department they belong to.

## UI changes (Manage user dialog)
- New "Roles" block: multi-select checkboxes for MA / DH / T. Disable removing the last MA in the system (guardrail).
- New "Departments" block (visible when role includes DH or T):
  - DH: single-select department (still 1:1).
  - T: multi-select departments with a "Primary" radio. Save calls `setUserDepartments`.
- "Save changes" button calls `updateUserRoles` then `setUserDepartments` in sequence, then invalidates `["all-users"]`.

## Guardrails
- MA-only via `requireRole(["MA"])` on every new fn.
- Cannot remove your own MA role.
- Cannot leave the system with zero MAs.
- Audit log entries: `UPDATE_USER_ROLES`, `SET_USER_DEPARTMENTS`.

## Out of scope
- No changes to auth, login flow, attendance, or the schedule builder UI beyond the trainer-pool query swap.
- Department CRUD untouched.
