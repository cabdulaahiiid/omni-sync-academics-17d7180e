# Centralized Master Data + Telephone Fields Across All Forms

Goal: every registration/data-entry form pulls its options live from the database master tables, dependent dropdowns filter by parent, and Student / Trainer / Department each carry a validated Ethiopian telephone number. No new master tables, no hard-coded option lists, no UI redesign.

## 1. Telephone fields

Database (one migration):
- `students.telephone` (text, nullable) — student's own number, separate from the existing guardian number.
- `departments.telephone` (text, nullable).
- `trainer_registry.phone` already exists — reused, no schema change.
- Uniqueness: partial unique indexes on non-null normalized numbers for `students.telephone` and `trainer_registry.phone`, so duplicates are rejected while blank legacy rows stay valid.

Behaviour:
- All three run through the existing `src/lib/phone.ts` validator/normalizer (+251 E.164), client-side inline error plus server-side Zod refinement — same pattern already used for guardian telephone.
- Required for new records; existing records without a number keep working and are only validated when edited.

## 2. Single source for master data

Add one server-function module (`src/lib/master-data.functions.ts`) exposing a single `getMasterData` read that returns departments, levels, sections, modules, trainers, venues and the enum-backed option lists (gender, student status, trainer status, module type, venue type, level names, academic level/semester records) straight from the database and Postgres enums already defined in the schema.

- One shared hook wraps it with TanStack Query so every form shares one cache entry.
- Cache is invalidated whenever an admin creates/edits/deletes a department, level, section, module, venue, trainer or academic level — so a newly added Level VI or Section appears in every dropdown immediately, with no duplicate master record.
- Deactivated/suspended records are excluded from *new* entry dropdowns but still render correctly on existing rows.

## 3. Forms converted to live dropdowns

| Form | Change |
|---|---|
| Student registration (Department Head → Students Hub) | Level, Section, Gender become dropdowns (currently free-text inputs); Section filtered by chosen Level; add Student Telephone field |
| Bulk student import | Gender values validated against master list instead of accepted as free text |
| Trainer registration (Admin → Trainers) | Department already a dropdown; add Status dropdown, make Telephone required + validated, qualifications become a multi-select of existing module codes instead of a comma-typed string |
| Department registration (Admin → Departments) | Add Department Telephone; Status stays a dropdown bound to the DB enum |
| Sections | Already dependent (Department → Level); switch its option source to the shared master-data hook |
| Modules | Add a single-module entry form with Department → Level dependent dropdowns and a Type dropdown; the Excel import path is unchanged but now resolves department/level against master data |
| Venues | Type dropdown bound to the DB enum instead of a literal list |
| Schedule Builder / other pickers | Repoint existing selects to the shared hook so they refresh with everything else |

Dependent chain everywhere it applies: Department → Level → Section → Module / Trainer. Selecting a parent clears and refilters children.

## 4. Preserved

Existing UI layout, RBAC and server-side role checks, RLS, workflows, conflict detection and all current records are untouched. Changes are additive: two nullable columns, one new read-only server function, and swaps of hard-coded option arrays for live queries.

## Technical notes

- Enum option lists come from the existing Postgres enums (`entity_status`, `entity_active`, `module_type`, `venue_type`, `level_name`) exposed through the generated types, so they can never drift from the database.
- `createStudent` keeps its name-based level/section resolution for CSV import, but the UI now submits ids resolved from master data, removing "Unknown level" errors.
- Telephone normalization is centralized in `src/lib/phone.ts`; no second validator is introduced.
- Verification pass over every form listed above (student, bulk import, trainer, department, section, module, venue, schedule builder) after implementation.
