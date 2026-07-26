## Goal

Three additive changes: multi-department trainers visible everywhere they're assigned, one user able to act as both Trainer and Department Head, and zero changes to the existing conflict-detection engine.

## What already exists (verified)

- `trainer_departments` table (with `is_primary`) plus `admin_set_trainer_departments` and `admin_set_dh_department` RPCs.
- Admin > Users & Roles already has role checkboxes (multi-role) and a multi-department picker with a primary selector, and already calls `updateUserRoles`, `setTrainerDepartments`, and `setDHDepartment` in one save.
- The Schedule Builder's trainer pool (`getBuilderOptions`) already unions `trainer_registry.department_id` with `trainer_departments`.
- Conflict checks in `semester-builder.functions.ts` and `dh-extras.functions.ts` already run institution-wide by trainer/venue/section, not per department.

## Gaps to close

### 1. Multi-department trainers on Department Head surfaces

Several DH-facing trainer lists still filter only by `trainer_registry.department_id`, so a trainer assigned to a second department never appears there:

- `src/lib/dh.functions.ts` — the trainer list for the DH Trainers page.
- `src/lib/dh-extras.functions.ts` — the trainer options for session editing and the trainer roster used by matrix/load views.

Fix: introduce one shared helper (e.g. `listTrainersForDepartment(deptId)`) that returns the union of primary-department trainers and `trainer_departments` rows, and use it in those places. Same read shape as today, just a wider set. Department scoping stays intact — a DH still only ever sees trainers linked to their own department.

### 2. Dual role (Trainer + Department Head)

- Keep role storage as-is (`user_roles`, one row per role) — it already supports multiple rows.
- When Admin saves a user with both DH and T checked, ensure a `trainer_registry` row exists and is linked (the existing `admin_set_trainer_departments` path already auto-links via `link_trainer_login`); make sure the Users & Roles save runs the DH-department and trainer-department steps in an order that works when both are set.
- Add a role switcher in the app header for users with more than one role, so a DH+T user can move between the Department Head workspace (`/operational`) and the Trainer app (`/ground`). Today `pickHome` sends them to `/operational` with no way back.
- Leave the existing shell guards untouched — they already admit a DH+T user to both shells; only the navigation affordance is missing.

### 3. Conflict detection — no changes

No edits to conflict logic. A short regression check will confirm that a trainer assigned to two departments still trips a cross-department overlap, and that a DH+T user gets the same validation.

## Technical notes

- Server-side only for the data changes; RBAC continues through `requireRole` and existing RLS. No new policies or migrations required — `trainer_departments` and both RPCs already exist.
- UI changes limited to: role switcher in the header shells, plus any labelling needed so a dual-role user sees both roles.
- No changes to `semester-builder.functions.ts` validation, `dh-extras.functions.ts` conflict scans, or approval workflows.

## Verification

- Assign one trainer to two departments; confirm they show in both DHs' trainer lists and both Schedule Builders.
- Give one user DH + T; confirm they can open both workspaces via the switcher, only manage their own department as DH, and appear as a schedulable trainer in every assigned department.
- Create overlapping sessions for a multi-department trainer in two departments; confirm the trainer conflict still fires.
