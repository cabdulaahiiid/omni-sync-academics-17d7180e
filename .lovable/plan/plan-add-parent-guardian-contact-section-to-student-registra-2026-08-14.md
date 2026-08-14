# Plan: Add Parent/Guardian Contact Section to Student Registration Form

## Goal
Add a single "Parent / Guardian Contact" section to the existing single-student registration dialog in the TVET ERP. No other modules, workflows, roles, or UI surfaces are changed.

## What will change

### 1. Database migration
- Add three columns to the existing `public.students` table:
  - `parent_guardian_name` (text, nullable)
  - `parent_guardian_telephone` (text, nullable)
  - `parent_guardian_relationship` (text, nullable)
- No new tables, no foreign keys, no separate parent/guardian module.

### 2. Server function update (`src/lib/students.functions.ts`)
- Extend the `StudentRow` Zod schema with the three new fields.
  - `parent_guardian_name`: trimmed string, max 160 chars, optional.
  - `parent_guardian_telephone`: trimmed string, max 40 chars, optional.
  - `parent_guardian_relationship`: enum from the required options, optional.
- Update `createStudent` insert payload to include the three values when provided.
- Keep `bulkInsertStudents` unchanged — bulk CSV import is not part of this request.

### 3. UI update (`src/routes/_authenticated/operational/students.tsx`)
- Add the three fields to the single-student registration dialog form state.
- Insert a new "Parent / Guardian Contact" section in the dialog, just before the Save/Register button.
- Use the existing design system (`Label`, `Input`, `Select`) to match current styling.
- Relationship dropdown options:
  - Father, Mother, Brother, Sister, Uncle, Aunt, Grandfather, Grandmother, Guardian, Other
- Save button remains disabled until required student fields are filled; parent/guardian fields remain optional.

### 4. Validation
- Client-side: same pattern as existing fields (controlled inputs + disabled Save button).
- Server-side: Zod schema enforces max lengths and allowed relationship values.

## What will NOT change
- Existing student roster table, bulk upload, CSV template, reports, attendance, scheduling, or any other module.
- Existing roles, permissions, RLS policies, and audit logging behavior.
- Login, dashboard, trainer mobile app, or strategic/operational shells.

## Implementation order
1. Run database migration to add the three nullable columns.
2. Update `src/lib/students.functions.ts` schema and insert logic.
3. Update `src/routes/_authenticated/operational/students.tsx` dialog form.
4. Typecheck and verify the registration flow end-to-end.
