# Forms & Input Tables Sample Document (PDF)

Create one new dedicated PDF that documents every data-entry form and input table in the system exactly as they appear in the app, plus a final filled sample set for the Student Registration form.

## Deliverable

`TVET_ERP_Forms_and_Input_Tables_Samples.pdf` — enterprise-branded, print-ready, PDF only.

## Contents

1. Cover page + document control (title, generated date, version, scope).
2. Form layout conventions — the shared section/grid pattern, required-field rules, telephone vs. email separation, Save behaviour (Validate → Save → Confirm → Refresh → Close).
3. One page (or more) per data-entry form, each with:
   - Screen name and route
   - Field table: Field label | Type (text/select/phone/email/file) | Required | Validation rule | Source (master data / free text)
   - Dependent-dropdown notes where applicable
   Forms covered: Student Registration, Trainer Registration, Department Head Registration, Manage User (email/telephone/password/status), Departments, Levels, Sections, Modules, Venues, Contact Book entry, SMS Composer, Level Schedule Builder (Sections 1–3).
4. Input/upload tables — for every bulk-import function, the exact column headers, order, required flags and an example row: Students roster, Modules, Other-staff contacts, Level timetable.
5. **Final Student Form Samples** — the student registration form rendered exactly like the app UI (sections: Student Identity, Contact, Academic Placement, Parent/Guardian) filled with 5 realistic dummy students, one full-page form per student, followed by a consolidated roster table of the same 5 records.

## Technical notes

- Field lists are read from the live form components (`src/routes/_authenticated/operational/students.tsx`, `strategic/trainers.tsx`, `department-heads.tsx`, `users.tsx`, `modules.tsx`, `sections.tsx`, `levels.tsx`, `venues.tsx`, `contacts.tsx`, `semester-upload.tsx`) and the shared building blocks in `src/components/forms/layout.tsx` / `fields.tsx`, so the document matches the real UI rather than being invented.
- Generated with a Python/ReportLab script using the existing report brand colours (navy header band, emerald accents) to match the current PDF report pack.
- Dummy data uses Ethiopian-format telephone numbers (09xxxxxxxx) consistent with the system's phone validation.
- No application code is modified; output is written to the documents area and QA'd page-by-page before delivery.
