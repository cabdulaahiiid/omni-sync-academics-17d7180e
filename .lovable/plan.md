# Move telephone from Department to Department Head + full user admin

## What changes

### 1. Department registration — remove telephone
- Drop the required "Department Telephone" field from the department create/edit dialog and from the departments table column.
- Server side stops requiring/writing `telephone` on departments. The column stays in the database (harmless, unused) so nothing else breaks.

### 2. Department Head — telephone required
- The "Create DH account" form gains a required **Telephone** field with the same Ethiopian validation used elsewhere (+251, 09/07 forms accepted, stored as `+251XXXXXXXXX`).
- The DH list shows the telephone column.
- Saved on the DH's profile record (`profiles.phone`, which already exists).

### 3. Users & Roles — full admin editing
In the "Manage user" dialog (Users & Roles page), Master Admin can:
- **Telephone** — edit and save any user's telephone, validated the same way. For trainers it also syncs the trainer registry phone so the Contact Book stays correct.
- **Password** — already present; kept as is.
- **Suspend / Activate** — a status toggle that sets the account active or suspended. A suspended user cannot sign in and is blocked from the app; reactivating restores access immediately.
- The user list gains a Status column (Active / Suspended) and a Telephone column.

## Technical notes
- Departments: remove `telephone` from the zod schema and insert/update payload in `src/lib/data.functions.ts`, remove the field from `src/routes/_authenticated/strategic/departments.tsx`, and drop it from the `departments` select in `src/lib/master-data.functions.ts`.
- DH: add validated `phone` to `createDepartmentHead` input in `src/lib/dh.functions.ts` (write to `profiles.phone`), return it from `listDepartmentHeads`, and add the input + column in `strategic/department-heads.tsx`.
- Users admin (`src/lib/users-admin.functions.ts`, all guarded by `requireRole(["MA"])`):
  - `adminSetUserPhone` — normalizes with `normalizeEtPhone`, updates `profiles.phone` and, when the profile is linked to a trainer, `trainer_registry.phone`; writes an audit log row.
  - `adminSetUserActive` — updates `profiles.active`, mirrors to `trainer_registry.status` when linked, and bans/unbans the auth user via the admin API so suspension actually blocks sign-in; audit-logged. Guard against an MA suspending their own account.
  - `listAllUsers` already returns `active`; add `phone` to the selected columns.
- Auth gate: `src/lib/auth/auth-provider.tsx` / `getMe` signs out and shows "Account suspended — contact administrator" when `profiles.active` is false.
- No schema migration needed: `profiles.phone`, `profiles.active` and `trainer_registry.phone` already exist.
