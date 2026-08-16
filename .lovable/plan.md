# Clear "what went wrong / what to do" errors for data entry and uploads

Today most failures surface the raw server text (`e.message`) in a toast — things like
`duplicate key value violates unique constraint "students_telephone_key"` or a bare
`Failed to fetch`. The user has to guess the cause and the fix.

This plan adds one translation layer so every form save and every file upload shows:

- **Problem** — the exact thing that failed, in plain words, naming the field/row/value.
- **Solution** — the exact next action to take.

## What changes for the user

Saving a form that fails shows an inline red panel above the buttons (and a matching toast):

```text
Telephone already registered
0912345678 is already used by another student.
Fix: enter a different number, or search the student list for 0912345678 and edit that record.
```

Uploading a workbook that fails shows a results panel instead of five stacked toasts:

```text
14 of 20 rows imported. 6 rows were skipped.
Row 4  · telephone   · "091234567"     · Must be 10 digits starting 09. Fix to 0912345678.
Row 7  · department  · "IT"            · No department named "IT". Use one of: ICT, Construction…
Row 9  · level       · empty           · Required. Enter Level 1–4.
```
with a **Download error report** button (the original rows plus a `problem` and `fix`
column) so the file can be corrected and re-uploaded.

Wrong-file cases are caught before parsing: wrong extension, empty sheet, missing or
misspelled column headers (named individually, compared against the template), and
too-large files each get their own message pointing at **Download template**.

## Cases covered

| Cause | Problem shown | Solution shown |
| --- | --- | --- |
| Unique violation (23505) | Which field and value is taken | Use a different value / open the existing record |
| Foreign key (23503) | Which referenced item is missing | Create it in master data first |
| Not-null / check (23502, 23514) | Which field is missing or invalid | What to enter |
| RLS / permission denied (42501) | Not allowed for your role | Who to ask, or switch role |
| Auth expired / 401 | Session ended | Sign in again (button in the panel) |
| Network offline / fetch failure | No connection to the server | Work stays in the form; retry button |
| Schedule conflicts | Trainer/venue/section already booked at that time | Which slot to move |
| Phone/email format | Exact rule violated | Correct format example |
| Upload parse/format/header issues | Which header/row/cell | Fix cell or download template |

## Technical notes

- New `src/lib/errors/explain.ts` — pure function `explain(error) -> { title, problem, solution, action? }`
  matching Postgres error codes, Supabase/PostgREST shapes, auth errors, network errors,
  and app-thrown messages; unknown errors fall back to the raw message plus a generic fix,
  never a blank message.
- New `src/components/forms/error-panel.tsx` — inline problem/solution block used by all forms.
- `src/hooks/use-form-submit.ts` stores the explained object instead of a string and shows
  `title` in the toast with the solution as the toast description. Every form already using
  this hook inherits the new behaviour with no per-form edits.
- Route files still calling `toast.error(e.message)` directly (users, trainers, departments,
  sections, levels, venues, modules, settings, profile, system-data, schedule builder) switch
  to a shared `toastError(e)` helper wrapping the same explainer.
- Server side: `students.functions.ts`, `modules.functions.ts`, and the other import handlers
  return structured row errors `{ row, column, value, code }` instead of prose, so the client
  renders consistent text and can build the error-report file.
- Upload UIs (students, modules, timetable) get pre-parse validation against the template
  headers in `src/lib/xlsx-templates.ts`, plus the results panel and XLSX error-report export.
- No schema changes, no changes to save/validation rules, no visual redesign of forms.
