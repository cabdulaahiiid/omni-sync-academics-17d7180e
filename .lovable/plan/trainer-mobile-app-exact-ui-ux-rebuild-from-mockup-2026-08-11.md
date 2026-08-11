# Trainer Mobile App — Exact UI/UX Rebuild from Mockup

Yes, this can be done. The 14-screen mockup maps cleanly onto the existing trainer app (`/ground/*`). This is a presentation-layer rebuild only: no server functions, no database, no geofence/attendance/timing logic, no auth changes.

## What the mockup requires vs. what exists

| Mockup screen | Existing surface | Work |
|---|---|---|
| 1. Login | `/login` | Restyle to card + navy Login button + "Continue with Google" + "Contact Admin" |
| 2. Dashboard | `/ground` | New: blue header with avatar + "Welcome back", 4 stat tiles (Today / Upcoming / Past / Missed), "Today's Sessions" cards |
| 3. Sessions Overview | new `/ground/sessions` | Tabs: Today / Upcoming / Past / Missed, grouped session list |
| 4. Pre-Class Preparation | `/ground/$scheduleId` step 1 | 5-step locked checklist (Prep, Details, Geo-fence, Start, Attendance) |
| 5. Session Details | same route, step 2 | Label/value detail table + Theory/Practical radio + outcome/objective inputs + geo checkbox |
| 6/7. Geo-fence Check / Passed | same route, step 3 | Radar graphic + accuracy line; passed state with green check |
| 8/9. Session Countdown | same route, step 4 | Large circular ring timer (blue → green when attendance unlocks) |
| 10. Take Attendance | same route, step 5 | Search + Select All, numbered student rows with checkboxes, Present/Absent legend |
| 11. Syncing & Generating | new overlay | PDF icon + progress checklist of sync steps |
| 12. Report Generated | `done` step | Green check, session summary block, Download PDF + End Session |
| 13. End Session | dialog | Confirm sheet listing the 3 effects, red confirm / outline cancel |
| 14. Back to Dashboard | `/ground` | Same as #2 with refreshed counts |

Bottom tab bar becomes 5 tabs to match the mockup: Home, Sessions, Students, Reports, Profile. Students and Reports are new read-only trainer views built on data the app already returns.

## Visual system (from the mockup)

- Navy header bar `#123E7C` spanning the top on Dashboard, white/blue back-header on inner screens.
- Page background light grey, white rounded cards with hairline borders and soft shadow.
- Status pills: In Progress (green), Upcoming (grey/amber), Missed (red).
- Primary buttons: full-width, navy, rounded, 48px tall. Destructive: red. Secondary: white with navy border.
- Type scale: 15–16px card titles, 12px meta line `CODE • Level N • Section X`.
- All colors go through scoped trainer theme tokens in `src/styles.css` (`.trainer-theme`), not hardcoded hex in components.

## Technical scope

Edited (UI only):
- `src/routes/_authenticated/ground.tsx` — header + 5-tab bar
- `src/routes/_authenticated/ground/index.tsx` — dashboard layout
- `src/routes/_authenticated/ground/$scheduleId.tsx` — screens 4–13 re-skinned around the current step machine (`setup → checkin → roster → done` stays as-is)
- `src/routes/_authenticated/ground/completed.tsx`, `profile.tsx` — matching styling
- `src/routes/login.tsx` — screen 1
- `src/styles.css` — trainer tokens

Added:
- `src/routes/_authenticated/ground/sessions.tsx`, `students.tsx`, `reports.tsx` (presentation views over existing server functions)
- small trainer UI components (stat tile, session card, ring timer, step list, geo radar)

Untouched: all `*.functions.ts`, database, RLS, geofence hook, offline queue, PDF generator, timing rules, DH/Admin workspaces.

## Notes

- The mockup's counters (Past 18, Missed 1) will be derived from existing schedule data; if a "missed" state isn't already derivable it renders as 0 rather than adding backend logic.
- Screen 11's sync steps reflect the real offline-sync stages already in the code.
