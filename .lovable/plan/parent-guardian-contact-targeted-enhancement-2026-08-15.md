# Parent/Guardian Contact — Targeted Enhancement

Four focused additions on top of the existing parent/guardian fields. No redesigns, no new permission system, no new export system.

## 1. Access rules (server-enforced)
Admin (MA), Department Head (DH) and Trainer (T) may view parent/guardian data, using the existing role helper (`requireRole` / `user_roles`). Enforcement lives in the server functions, not in the UI:

- The guardian columns are only selected and returned when the caller's role is allowed.
- Trainers only receive guardian data for students in sections they actually teach (their existing published-schedule scope); they cannot edit it.
- Editing/creating guardian data stays with MA and DH, as today.
- Any caller without a role gets rows with the guardian fields stripped, even when calling the API directly.

## 2. Telephone validation and formatting
Ethiopian convention, one shared helper reused by client and server:

- Accepted input: `09XXXXXXXX`, `9XXXXXXXX`, `+2519XXXXXXXX`, `2519XXXXXXXX` (spaces/dashes ignored). Mobile `9` and landline `7` prefixes both accepted.
- Stored normalized as `+2519XXXXXXXX`.
- Anything else is rejected before saving, with the message: "Please enter a valid parent/guardian telephone number."
- Empty stays allowed (field is optional today).
- Same rule applied in the registration dialog (inline error, save blocked) and in the server validator, so the API cannot be bypassed.

## 3. Student list and exports
On the existing Students Hub roster:

- Three extra columns — Guardian, Telephone, Relationship — rendered only when the returned data includes them (i.e. permission granted).
- Export buttons reuse the existing report export module (`downloadCsv` / `downloadPdf` from `report-export.ts`) with the roster shaped as a standard report result, so branding, headers and watermark are identical to other exports. The guardian columns appear only when permitted.

## 4. Student profile / details
Clicking a roster row opens a details panel using the existing dialog components, showing student identity plus a "Parent / Guardian Contact" block (Name, Telephone, Relationship). The block is omitted entirely when the fields are not permitted/returned.

## Technical notes
- New file `src/lib/phone.ts`: `normalizeEtPhone(input)` + `isValidEtPhone(input)` — the single validation/formatting utility, no new dependency.
- `src/lib/students.functions.ts`: use the phone helper in the Zod schema (`createStudent`, `bulkInsertStudents`), and extend `listMyStudents` to resolve caller roles and conditionally include the three columns; add a `canViewGuardian` flag in the response for the UI.
- `src/routes/_authenticated/operational/students.tsx`: inline phone error, three conditional table columns, row-click details dialog, and an export control wired to the existing export helpers.
- No database migration required — the three columns already exist.
