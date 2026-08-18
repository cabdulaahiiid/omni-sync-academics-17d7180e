# Roster template matches the on-screen roster columns

The bulk-upload workbook drops the Level and Section columns. Level and Section are already
chosen with the pickers above the dropzone, so the system fills them in for every row.

## New template columns

| Column | Required | Type / accepted values | Example |
| --- | --- | --- | --- |
| student_id_code | No (auto-generated when blank) | text, unique | ICT-26-0001 |
| full_name | Yes | text | Abdi Mohammed Ali |
| gender | No | Male / Female (M / F accepted) | Female |
| telephone | No | student phone, Ethiopian 09/07…, unique | 0912345678 |
| parent_guardian_name | No | text | Ahmed Hassan |
| parent_guardian_telephone | No | Ethiopian phone | 0911223344 |
| parent_guardian_relationship | No | Father, Mother, Brother, Sister, Uncle, Aunt, Grandfather, Grandmother, Guardian, Other | Father |

No level or section column. Both come from the Level and Section selectors on the upload card
and are applied to every row in the file.

## Behaviour

- Import is blocked with a clear message until Level and Section are selected, since the file
  no longer carries them.
- Files that still contain `level_name` / `section_name` columns keep working: those values are
  honoured per row, and blanks fall back to the selectors. Nothing already uploaded breaks.
- Instructions sheet is updated to the seven columns and states that Level and Section are taken
  from the screen selectors.

## Technical notes

- `STUDENTS_ROSTER_TEMPLATE` in `src/lib/xlsx-templates.ts`: remove `level_name` and
  `section_name` from `columns` and from the example rows; add a note on the Instructions tips
  that Level/Section are selected on screen.
- `src/routes/_authenticated/operational/students.tsx`: keep the existing per-row fallback
  mapping, and replace the current "Some rows have no level or section" throw with a pre-check
  that requires the Level and Section selectors when the file has no level/section columns.
- Also update the dropzone helper text listing accepted columns to the seven above.
- No changes to `bulkInsertStudents`, the schema, or RLS.
