# Fix student saving, add sample hints to forms, auto-generate IDs

## 1. "New row violates row-level security policy for table students"

Confirmed cause: the `students` table only has two access rules — Master Admin can do everything, Department Heads can **read** their own department. There is no rule allowing a Department Head to add or edit a student, so every save from the DH student page is rejected.

Fix (database migration):
- Allow a Department Head to create, edit and deactivate students **only inside their own department**.
- Keep Master Admin full access and trainers read-only as today.
- Same gap exists for `trainer_registry` (DH can read but not write). Add the equivalent department-scoped create/edit rule so trainer registration from the DH side does not hit the same error.
- If the save still fails, the error now reads as a plain "Not allowed for your role" message via the existing error explainer.

## 2. Sample data shown inside every form field

Every text/phone/email/ID input across the registration and master-data forms gets a realistic example placeholder plus a short hint where the rule is not obvious, e.g.

```text
Full name            Abdi Mohammed Ali
Telephone            0912345678
Email                abdi@tvet.edu.et
Student ID           ICT-26-0001
Module code          ICT-201
Venue capacity       40
```

Applies to: Student registration, Trainer registration, Department Head, Users & Roles, Departments, Levels, Sections, Venues, Modules, Contacts/SMS and the Schedule Builder fields.

## 3. Auto-generated Student and Trainer IDs

Format: `ICT-26-0001` — department short code, two-digit year, four-digit running number.

- The short code comes from the department (e.g. Information Technology → `ICT`); a department code is stored so it is stable, defaulting to the first letters of the department name when not set.
- Opening the Student or Trainer registration form immediately shows the next free ID in the field.
- The field is **prefilled but editable**, so an admin can override it.
- Numbering restarts each year per department, and skips numbers already used, so two people registering at the same time cannot collide.
- Bulk imports keep any ID given in the file; blank ID cells are filled with the next generated ID.

## Technical notes

- Migration: add `code text` to `departments` (auto-filled from existing names, unique), DH insert/update policies on `students` and `trainer_registry` scoped to `current_department_id()`, and a `next_entity_code(_department_id uuid, _kind text)` security-definer function that computes the next `XXX-YY-NNNN` from existing rows.
- New server function `nextStudentId` / `nextTrainerId` in `students.functions.ts` and `trainer.functions.ts` calling that RPC; the registration dialogs fetch it on open and on department change.
- Placeholders/hints are presentation-only props added to `TextField`, `PhoneField`, `EmailField` call sites; no validation or save logic changes.
