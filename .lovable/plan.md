# Header aliasing for the student roster upload

Today the roster upload only recognises a narrow set of exact header names. A file whose first row says "Student ID", "Name", "Guardian", "Relationship" is rejected as missing `full_name`, even though the data is fine. This makes the uploader accept those natural spellings.

## What changes

A shared header-normalizer runs on every uploaded Excel/CSV file, before validation:

- Headers are trimmed, lowercased, and inner spaces/dashes collapsed to `_`, so `Student ID`, `student-id`, and `STUDENT_ID` all read the same.
- Recognised aliases map to the canonical column names:
  - `name`, `full name`, `student name`, `student_name` -> `full_name`
  - `student id`, `student_id`, `id`, `student id code`, `registration number` -> `student_id_code`
  - `guardian`, `parent name`, `guardian name`, `parent/guardian name` -> `parent_guardian_name`
  - `guardian telephone`, `parent telephone`, `guardian phone`, `parent phone`, `guardian tel` -> `parent_guardian_telephone`
  - `relationship`, `guardian relationship`, `parent relationship` -> `parent_guardian_relationship`
  - `phone`, `tel`, `mobile`, `telephone number` -> `telephone`
  - `sex` -> `gender`
- Unrecognised headers are kept in their normalized form, so nothing is silently dropped.
- Required-column checking runs against the mapped names, so "Name" now satisfies the `full_name` requirement.
- If two columns map to the same canonical name, the first non-empty value per row wins and the file is not rejected.

Level and Section keep coming from the on-screen selectors as they do now.

## Error messages

When a required column is still missing, the message lists the headers that were found after mapping, so the user can see exactly how their file was interpreted.

## Technical notes

- New `src/lib/import-headers.ts` exporting `normalizeHeader(raw)` and `canonicalizeRow(row)` with the alias table above.
- `src/components/csv-dropzone.tsx`: apply `canonicalizeRow` to both the Excel and CSV parse paths before the `requiredHeaders` check, replacing the current inline lowercase-only normalization.
- `src/routes/_authenticated/operational/students.tsx`: simplify the `bulk` row mapping to read canonical keys (the ad-hoc `r.name` / `r.guardian_name` fallbacks become unnecessary).
- No database or server-function changes; `bulkInsertStudents` already accepts the canonical field names.
