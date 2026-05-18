# Plan: Levels auto-seed + Semesters & Venues admin

## 1. Automatic levels (I–V) per department

The `levels` table already exists with enum `level_name = {I, II, III, IV, V}`. We'll make level provisioning automatic so admins never manage it manually.

- **DB migration**: add a trigger `AFTER INSERT ON public.departments` that inserts the 5 rows (I, II, III, IV, V) for the new department. Also run a one-time backfill: insert any missing (department_id, level) pairs for existing departments.
- **Levels page** (`/strategic/levels`): convert from placeholder to a **read-only** view grouped by department showing the 5 levels as badges. Copy explains "Levels are provisioned automatically (I–V) for every department."
- No UI for creating/deleting levels (intentional — fully automated).

## 2. Semesters admin page (`/strategic/semesters`)

MA-only CRUD using existing `semester_registry` table.

- New server fns in `src/lib/data.functions.ts`: `listSemesters`, `upsertSemester`, `deleteSemester`.
- Form fields:
  - **Year** (number, e.g. 2026)
  - **Term** (select: `Semester 1`, `Semester 2`, `Summer Course`)
  - **Start date**, **End date** (date pickers)
  - Auto-compose `name` as `"Year {year} – {term}"` (e.g. `"Year 2026 – Semester 1"`).
  - **Status** select (`ACTIVE`, `CLOSED`, `ARCHIVED`) — defaults `ACTIVE`. Approval-driven states (`DRAFT`/`PENDING_MA`/`LIVE`/`ENDED`) shown read-only as badges if encountered.
- Table: Name • Term • Year • Start • End • Status • Actions (Edit / Delete).
- Validation: end_date > start_date; unique (year, term).

## 3. Venues admin page (`/strategic/venues`)

MA-only CRUD using existing `venues` table.

- New server fns: `listVenues`, `upsertVenue`, `deleteVenue`.
- Form fields:
  - **Name** (text)
  - **Type** (select: `Classroom`, `Lab`, `Workshop`)
  - **Capacity** (number)
  - **Latitude / Longitude** (number inputs, with helper "use device GPS" button that calls `navigator.geolocation` to fill)
  - **Geo radius (meters)** — default 50
- Table: Name • Type • Capacity • Coordinates • Radius • Actions.

## 4. Sidebar / routing

No new routes needed — `levels`, `semesters`, `venues` already exist in `strategic.tsx` shell. Just replace the placeholder components.

## Technical details

- Pattern: mirror existing `departments.tsx` (useServerFn + react-query + Dialog form + shadcn Table).
- All mutations gated by `has_role(auth.uid(),'MA')` via existing RLS policies — no policy changes needed.
- Trigger SQL:
  ```sql
  CREATE OR REPLACE FUNCTION public.seed_department_levels()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
  BEGIN
    INSERT INTO public.levels (department_id, name)
    SELECT NEW.id, l::level_name FROM unnest(ARRAY['I','II','III','IV','V']) l
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END $$;
  CREATE TRIGGER trg_seed_levels AFTER INSERT ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.seed_department_levels();
  ```
  (Add a UNIQUE(department_id, name) constraint on `levels` to make ON CONFLICT work, and backfill existing depts.)

## Files touched

- `supabase/migrations/<new>.sql` — unique constraint, trigger, backfill.
- `src/lib/data.functions.ts` — add listLevels, listSemesters/upsertSemester/deleteSemester, listVenues/upsertVenue/deleteVenue.
- `src/routes/_authenticated/strategic/levels.tsx` — read-only grouped view.
- `src/routes/_authenticated/strategic/semesters.tsx` — full CRUD.
- `src/routes/_authenticated/strategic/venues.tsx` — full CRUD.
