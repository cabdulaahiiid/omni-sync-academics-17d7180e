# Excel-ready student roster upload

The roster uploader currently accepts CSV only and rejects `.xlsx` files, and its template
covers just three columns while the system actually accepts nine student fields. The fix makes
the uploader read real Excel workbooks and ships a template whose columns are exactly the
fields the database accepts.

## What changes for the user

- **Bulk roster upload** accepts `.xlsx`, `.xls` and `.csv`. Dropping an Excel file parses the
  first sheet directly — no "Save As CSV" step.
- **Sample template** becomes the complete, upload-ready workbook:

| Column | Required | Type / accepted values | Example |
| --- | --- | --- | --- |
| student_id_code | No (auto-generated when blank) | text, unique | ICT-26-0001 |
| full_name | Yes | text | Abdi Mohammed Ali |
| gender | No | Male / Female (M / F accepted) | Female |
| telephone | No | Ethiopian phone 09/07…, unique | 0912345678 |
| level_name | Yes* | must match a level in your department | I |
| section_name | Yes* | must match a section under that level | A |
| parent_guardian_name | No | text | Ahmed Hassan |
| parent_guardian_telephone | No | Ethiopian phone | 0911223344 |
| parent_guardian_relationship | No | Father, Mother, Brother, Sister, Uncle, Aunt, Grandfather, Grandmother, Guardian, Other | Father |

  *If the file leaves level/section blank, the Level and Section pickers above the dropzone are
  used, so existing single-section files keep working. Values in the file win when present.

- The template keeps its **Instructions** sheet listing every column, whether it is required,
  its type, allowed values and an example — so a downloaded template is 100% uploadable as-is.
- Guardian name, guardian telephone and relationship now actually save on bulk import (today
  they are dropped even when present).
- Pre-upload checks give exact messages: wrong file type, empty sheet, missing header (named
  individually), and unknown level/section listing the valid options.

## Technical notes

- Replace `src/components/csv-dropzone.tsx` usage with an extended dropzone that parses with
  the already-installed `xlsx` library: `.csv/.txt` via text parse, `.xlsx/.xls` via
  `XLSX.read(arrayBuffer)` + `sheet_to_json({ defval: "", raw: false })`. Headers are trimmed
  and lower-cased, so header case/spacing differences don't fail the file.
- Header aliases accepted: `student_id_code`/`registration_number`, `telephone`/`phone`,
  `level_name`/`level`, `section_name`/`section`, `guardian_*` variants.
- `STUDENTS_ROSTER_TEMPLATE` in `src/lib/xlsx-templates.ts` expands to the nine columns above
  with three filled example rows.
- `src/routes/_authenticated/operational/students.tsx` maps the new columns into the bulk
  payload and falls back to the level/section selectors per row.
- `bulkInsertStudents` in `src/lib/students.functions.ts` adds the three guardian fields to the
  insert payload (the row schema already validates them) and validates guardian phones with the
  existing Ethiopian normalizer, reporting bad values as row errors.
- No schema changes; existing single-student form, RLS and audit logging are untouched.
