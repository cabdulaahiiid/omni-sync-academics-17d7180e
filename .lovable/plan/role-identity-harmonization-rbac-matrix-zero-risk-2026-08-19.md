# Role identity harmonization + RBAC matrix (zero-risk)

Section 1 (persistent shell, back button, breadcrumbs, sidebar highlight on every
`/cooperative-training/*` route) is already live, so this plan covers roles, the access
matrix, and department-trainer data sync only.

## 1. One canonical role registry

Database codes stay exactly as they are (`MA`, `DH`, `T`, `PD`, `IPS`, plus the existing
enterprise/mentor codes). No migration, no data rewrite, no policy churn — so nothing can
break.

`src/lib/auth/roles.ts` becomes the single source of truth and gains the new identifiers
as first-class names mapped onto those codes:

| New identifier | DB code | Display label |
| --- | --- | --- |
| SYSTEM_ADMIN | MA | System Administrator |
| DEPARTMENT_HEAD | DH | Department Head |
| INDUSTRIAL_PRACTITIONERS_SUPERVISOR | IPS | Industrial Practitioners Supervisor |
| PROGRAM_DIRECTOR | PD | Program Director (kept — owns director review) |
| TVET_TRAINER | T | TVET Trainer |
| ENTERPRISE_TRAINER | EM / TR | Enterprise Trainer |
| SYSTEM_ENGINE | (no login) | Automated System |

`SYSTEM_ENGINE` is a code-side actor label only, used to attribute automated writes
(SMS dispatch, absence detection, scheduled jobs) in audit and workflow event logs. It is
never assignable to a person and never grants UI access.

Every screen that prints a role — sidebar subtitle, top-bar identity chip, Users & Roles
table and Manage User dialog, role switcher, CT queues — reads its label from this
registry instead of hardcoded strings, so wording is identical everywhere.

## 2. RBAC matrix in one place

A single declarative matrix (module → allowed roles) replaces the role arrays currently
scattered across route files:

- Strategic / master data / users / audit: SYSTEM_ADMIN
- Department operations, scheduling, students: DEPARTMENT_HEAD (own department), SYSTEM_ADMIN
- Practical training requests: DEPARTMENT_HEAD (industrial), IPS, SYSTEM_ADMIN
- Supervisor queue: IPS, SYSTEM_ADMIN
- Director review: PROGRAM_DIRECTOR, SYSTEM_ADMIN
- Placements / logbooks / supervision / evaluation: IPS, PROGRAM_DIRECTOR, TVET_TRAINER, SYSTEM_ADMIN
- Industry app (`/industry`): ENTERPRISE_TRAINER
- Reports & gap analytics: IPS, PROGRAM_DIRECTOR, DEPARTMENT_HEAD, SYSTEM_ADMIN

The CT tab strip, the sidebar nav builder, and the role switcher all derive visibility from
this matrix. Server-side enforcement is unchanged: existing `requireRole` guards and RLS
policies keep using DB codes, so the security boundary is untouched — the matrix only drives
what the UI offers.

## 3. Department ↔ trainer sync check

The department-scoped trainer service (`listCtDepartmentTrainers`, `setCtPlacementTrainer`)
already backs the Placements dropdown and the Requests capacity panel. This plan adds:

- The same department-scoped trainer picker on the Supervision screen (visiting trainer for
  a visit), so trainer selection is consistent across all CT screens.
- Availability, current assigned load, and competency tags shown in every trainer picker,
  not just Placements.

## Technical notes

- Files touched: `src/lib/auth/roles.ts` (registry + matrix), a small `role-matrix` helper,
  `operational-nav.tsx`, `cooperative-training.tsx` tab list, `role-switcher.tsx`,
  `app-shell.tsx` / `strategic-shell.tsx` / `ground.tsx` labels, `strategic/users.tsx`,
  and `cooperative-training/supervision.tsx`.
- No database migration. No change to `app_role`, RLS, or security-definer functions.
- Existing auth/role unit tests continue to run against DB codes; new tests cover the
  identifier→code mapping and the matrix.
