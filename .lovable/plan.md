## Scope

Two small fixes, both UI-facing. No schema changes.

### 1. Login page — remove duplicate welcome block

The "Welcome to TVET ERP / Empowering TVET Institutions with Smart ERP Solutions" text is **baked into the background image** `src/assets/login-bg.png` (it appears twice in the PNG itself — once above the three feature cards and once below them). Nothing in the React code renders that text, so the fix is to the image asset, not to `login.tsx`.

Approach:
- Open the current PNG (1333 × 800).
- Keep top band `y = 0 … 540` (sky, building, flags, first "Welcome to TVET ERP" headline, tagline, and the three feature cards: Centralize Institution Data / Optimize Resources / Enhance Training Outcomes).
- Drop the duplicate band `y = 540 … 740` (second "Welcome to TVET ERP" + repeated tagline).
- Keep the bottom band `y = 740 … 800` (the "Developed by Talosan IT Consultant" credit line + Lovable badge area).
- Stitch the two kept bands into a new 1333 × 600 PNG and overwrite `src/assets/login-bg.png` (asset JSON stays the same — same `asset_id`, same URL, just new bytes).
- No code change in `src/routes/login.tsx`; existing `bg-cover bg-center` styling still works.

### 2. DH Semester Schedule Builder — Section 3 trainer list must show every trainer of the department

Today `getBuilderOptions` in `src/lib/semester-builder.functions.ts` only returns trainers that satisfy **all** of:
1. a row in `user_roles` with `role = 'T'`,
2. a `profiles` row whose `trainer_registry_id` is not null,
3. a `trainer_departments` row for the selected department.

That excludes trainers who were registered for the department in `trainer_registry` but haven't logged in yet or aren't linked through `trainer_departments`. DH users see an empty / partial trainer pool.

Fix (server-only, no UI change):
- Build the candidate trainer set from `trainer_registry` for the chosen department as the **union** of:
  - `trainer_registry.department_id = deptId` (primary department fallback), and
  - `trainer_departments.department_id = deptId` (multi-department assignments).
- Drop the "must have role T + linked profile" gate; instead, **left-join** profile data (full_name, email) when present so trainers with a login still show their login email, and trainers without a login still appear by `trainer_registry.full_name` / `hidden_staff_id`.
- Keep the MA "no department" branch behaving as today (returns all trainers).
- No change to `saveBuilderDraft` validation — it already checks `trainer.department_id === data.department_id`, which still holds for primary-dept trainers; for multi-dept trainers it will continue to pass via the existing `trainer_departments` membership check path used elsewhere. (If a regression is observed for multi-dept saves, relax the equality check to "primary dept OR member of `trainer_departments` for that dept" in the same edit.)

## Files touched

- `src/assets/login-bg.png` — overwrite with cropped PNG (binary only).
- `src/lib/semester-builder.functions.ts` — rewrite the trainer-loading branch inside `getBuilderOptions`.

## Out of scope

- No DB migration, no RLS change, no route changes.
- No changes to Users & Roles, attendance, approvals, or other modules.
- Login form layout, copy, and styling stay exactly as they are.
