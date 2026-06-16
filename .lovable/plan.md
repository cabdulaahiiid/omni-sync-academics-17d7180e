
## Goal

Block "Save as Draft" in Semester Upload until the uploaded Excel timetable is free of **global** Trainer/Venue double-bookings — across every department in the institution — with descriptive, row-level error messages.

## Scope

Changes are confined to the Semester Upload workflow:
- `src/lib/dh-extras.functions.ts` — `uploadSemesterSchedule` validation handler
- `src/routes/_authenticated/operational/semester-upload.tsx` — UI error summary
- No DB schema, RLS, or other module changes

## Backend: descriptive global conflict check

`uploadSemesterSchedule` already overlaps new rows against the `schedules` table on shared dates. Two corrections:

1. **Bypass RLS for the read** — under DH RLS, the cross-department schedules query returns no rows, so cross-dept conflicts are silently missed. Inside the handler (after the existing `requireSupabaseAuth` check), lazy-import `supabaseAdmin` from `@/integrations/supabase/client.server` and use it **only** for the conflict-detection SELECT (existing schedules + a join to `departments`, `trainer_registry`, `venues` for names). All writes continue to use the user-scoped `supabase` client so RLS still enforces who can save drafts.

2. **Enrich the conflict payload.** Replace the current `{ row_a, row_b, date, kind }` items with:
   ```ts
   {
     row: number;              // 0-based Excel row (matches existing _row)
     kind: "trainer" | "venue" | "section";
     date: string;             // YYYY-MM-DD
     start_time: string;       // HH:MM
     end_time: string;         // HH:MM
     resource_name: string;    // trainer or venue name
     conflict_with: {
       scope: "intra_batch" | "existing";
       department_name: string | null;   // null for intra-batch
       module_code: string;
       row_b?: number;                   // for intra-batch
     };
     reason: string;           // "Trainer Jane Doe is already booked by Mathematics on 2026-02-10 09:00–10:00 (MATH101)."
   }
   ```
   The `reason` string is produced server-side using the exact template:
   `"<Trainer|Venue> <name> is already booked by <Department> on <date> <start>–<end> (<module_code>)."`
   For intra-batch overlaps: `"<Trainer|Venue> <name> double-booked within this upload on <date> <start>–<end> (rows X and Y)."`

3. **`ok` gate** unchanged: `ok = errors.length === 0 && conflicts.length === 0`. `validate_only:false` is rejected the same way, so even a direct "Save as Draft" call can't bypass.

4. Trainer/Venue checks always run globally. Section overlap stays department-scoped (sections are department-local).

## Frontend: red-highlighted error summary

In `semester-upload.tsx`:

- Compute `conflictRows = new Set(conflicts.map(c => c.row))`.
- Replace the current "Conflicts" badge list in the Validation report card with two stacked blocks:
  - **Conflict summary** — a `border-destructive` panel listing each conflict's `reason` string, grouped by Excel row. One row per conflict, prefixed with `Row {row+1}` and a red dot.
  - **Affected rows preview** — a small table of the offending rows from the parsed `rows` array (module_code, trainer_name, venue_name, day, start_time), each `<tr>` styled with `bg-destructive/10 text-destructive` so the user can see exactly which Excel rows to fix.
- Keep the existing toast message but add a count: `"Validation failed: N global conflicts. Save is blocked."`
- "Save as Draft" stays disabled while `validated === false`. After any file change or re-validation that produces conflicts, force `setValidated(false)` (already happens).

## Technical notes

- `supabaseAdmin` must be imported inside the handler (`await import(...)`) per the server-functions-modern rule — never at module scope of `*.functions.ts`.
- The admin read is limited to: `schedules` (date in batch dates, status in `DRAFT/PENDING_MA/LIVE/ACTIVE`), plus a single batched lookup for department/trainer/venue names by id. No user PII is exposed beyond names already visible in DH dashboards.
- Existing same-semester exclusion (`b.semester_id === data.semester_id`) is preserved so re-validating a draft semester doesn't conflict with itself.
- Overlap formula is the existing `!(a.end <= b.start || b.end <= a.start)` on `HH:MM:SS` strings — equivalent to `(NewStart < ExistingEnd) AND (NewEnd > ExistingStart)`.

## Out of scope

- No changes to the draft editor, week feedback workspace, approval flow, or any non-upload validation.
- No new DB tables, RPCs, or migrations.
