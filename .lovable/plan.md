
## Scope

Per your answers:
- **Sections + Modules**: scoped Department → Level. Sections also get a `name` (A, B, …).
- **Venues & Semesters**: stay global (no changes to those pages).
- **Levels**: add Department filter + allow rename / disable.

## Changes

### 1. Database migration

The `sections` table already exists with `department_id`, `level_id`, `name`. Only `levels` needs changes to support rename + disable:

```sql
ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS status entity_status NOT NULL DEFAULT 'ACTIVE';
```

- `display_name` = optional override label (defaults to the enum `name` like "I", "II", … when null).
- `status` = `ACTIVE` / `INACTIVE` (toggle for disable).

Also add a uniqueness guard on sections so `(department_id, level_id, name)` can't duplicate:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS sections_dept_level_name_idx
  ON public.sections (department_id, level_id, name);
```

### 2. Server functions (`src/lib/data.functions.ts`)

Add:
- `listSections({ department_id?, level_id? })` — joins dept/level names for display.
- `createSection({ department_id, level_id, name })` — admin only.
- `deleteSection({ id })`.
- `updateLevel({ id, display_name?, status? })` — rename / toggle active.

All gated by `requireSupabaseAuth` + MA role check.

### 3. Sections page (`src/routes/_authenticated/strategic/sections.tsx`)

Replace the stub with:
- Cascading filters at top: **Department** select → **Level** select (filtered to that dept's levels).
- "Add section" dialog: same Dept → Level cascade + name input ("A", "B", "C"…).
- Table of existing sections with Department, Level, Name, Delete button.

### 4. Levels page (`src/routes/_authenticated/strategic/levels.tsx`)

Add:
- Department filter dropdown at the top.
- Each row: inline edit pencil for `display_name`, switch for `status` (Active/Inactive).
- Keep the auto-seed (I–V) behavior intact — admin can only rename / disable, not delete.

### 5. Modules page (`src/routes/_authenticated/strategic/modules.tsx`)

Audit the create-module form to confirm the Department → Level cascade is enforced (level options filtered by selected department). If it currently shows all levels in one flat list, fix the Level select to depend on the chosen Department.

### 6. Venues & Semesters

No changes — they remain institution-wide as you confirmed.

## Files touched

- `supabase/migrations/<new>.sql` — add `display_name`, `status` to `levels`; unique index on `sections`.
- `src/lib/data.functions.ts` — add section CRUD + `updateLevel`.
- `src/routes/_authenticated/strategic/sections.tsx` — full implementation.
- `src/routes/_authenticated/strategic/levels.tsx` — dept filter + edit/disable controls.
- `src/routes/_authenticated/strategic/modules.tsx` — verify/fix Dept→Level cascade in create form.

No changes to venues.tsx, semesters.tsx, or RLS (existing MA-write / public-read policies cover everything).
