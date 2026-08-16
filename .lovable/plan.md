# DH Scheduling Workflow Corrections

Strictly scoped to the Department Head schedule builder and DH drafts view. Admin (MA) behaviour, permissions, UI and approval logic stay exactly as they are; every change is applied role-aware so MA keeps today's flow.

## Current state (verified)

- The DH builder lives at `/operational/semester-upload`. Section 1 picks an Academic Year and then a "Level" that is actually a row in the term registry (e.g. "Year 2026 – Level 1") which supplies the start/end dates and week numbering.
- The real Level entity is a separate table of levels I–V per department, and every module is linked to exactly one of those levels. Modules also carry a department.
- Today the Module picker lists every module of the department with no level filter, and the Level picker sits inside Section 5 "Class Assignment" (Level + Section + Venue). Level is inferred backwards from the chosen module.
- Saving a draft writes one schedule row per session occurrence; weeks are already stored per row (`week_num`). The DH drafts page groups those rows by week only.

## 1. Year + Level drives the module list

- Section 1 becomes: **Academic Year** -> **Term/period** (existing dates source, unchanged) -> **Level** (I–V of the DH's department).
- The Module picker in Section 2 is disabled until a Level is chosen, and then lists only modules whose level matches the selected Level, using the stored level relationship (not name matching).
- Changing the Level clears the selected Module, the Section, and re-derives the list. A module from the previous level can never stay selected.
- The reverse sync (module sets the level) is removed.

## 2. Class Assignment keeps Section + Venue only

- The Level control is removed from Class Assignment; the section list is filtered by the Level chosen in Section 1.
- Preview panel still shows the Level (read-only), sourced from Section 1.

## 3. Validation before save

Save to Draft stays blocked until every required field is present and server validation passes. The client shows a field-specific list of what is missing (Academic Year, Term, Level, Module, Trainer, Section, Venue, delivery days, duration, start date, start time).

Server-side (`validateBuilder` and `saveBuilderDraft`), for DH callers, additionally reject with a clear message when:
- the module does not belong to the selected level,
- the section does not belong to the selected level,
- the module/level/section/venue/trainer are outside the DH's department,
- existing conflict detection reports a conflict (unchanged logic).

These checks run for DH regardless of what the browser sends, so a manipulated request cannot create an invalid Level–Module pair. MA calls keep their current, looser behaviour.

## 4. Two draft representations from one record

No new tables and no duplicate schedules. The saved schedule rows remain the single source of truth; both views are generated from them.

On the DH Active Drafts page, add a view switch:

```text
DH Schedule Draft (schedule rows)
        |
        +-- Weekly View  -> W1, W2, W3, ... (auto from the rows' week numbers)
        |
        +-- Full Module View -> "Electrical Installation — Level III", start -> end, totals
```

- **Weekly view**: the existing week cards, unchanged behaviour (submit, feedback, resubmit).
- **Full Module view**: rows grouped by module + level + section, showing module name and level, trainer, first and last session date, week span, session count and total hours, plus the same submit/status actions at module level.
- Both read the same query, so editing or deleting a draft session updates both views on the next refresh; no extra records are written.
- This switch renders for DH only; when a Master Admin opens the page the current view is what they see today.

## 5. Acceptance checks

Each of the ten listed tests is exercised after implementation: level-filtered modules, module cleared on level change, server rejection of a mismatched pair, Class Assignment showing only Section and Venue, successful draft save, weekly W1..Wn view, full-module view, both views staying in sync, unchanged Admin behaviour, and persistence across reload.

## Technical notes

- Files touched: `src/routes/_authenticated/operational/semester-upload.tsx` (Section 1/2/5 wiring, validation summary), `src/lib/semester-builder.functions.ts` (level-aware option loading plus DH server guards in `validateBuilder` / `saveBuilderDraft`), `src/routes/_authenticated/operational/drafts.tsx` (weekly / full-module switch), and a small addition to `src/lib/semester-drafts.functions.ts` to return module-level grouping alongside the existing week buckets.
- Role separation uses the existing `requireRole` result: `MA` keeps current paths, `DH` gets the new enforcement.
- No schema migration, no change to conflict detection, approval RPCs, or Admin routes.
