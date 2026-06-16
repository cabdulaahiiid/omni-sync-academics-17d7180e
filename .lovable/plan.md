## Trainer Mobile Workflow — full alignment with reference

Restructure the trainer (Ground) mobile experience into the 6-screen flow from the mockup, fully wired to existing server functions and DB. All work in one deployment, fully functional, using the existing global UX (shadcn cards, semantic tokens, mobile shell already at `/ground`).

No backend/database changes — `getTrainerToday`, `getScheduleDetail`, `setSessionMode`, `trainerCheckIn`, `submitSessionBatch`, `trainerEndSession`, `getMyProgress` already cover every step.

### Screen map

| # | Mockup screen        | Route                                  |
|---|----------------------|----------------------------------------|
| 1 | Login                | `/login` (existing, unchanged)         |
| 2 | Today's Timetable    | `/ground` (refined)                    |
| 3 | Session Context Setup| `/ground/$scheduleId` (Setup step)     |
| 4 | Session Started      | same route, Check-in step              |
| 5 | Active Attendance    | same route, Roster step                |
| 6 | Session Completed    | same route, Summary step               |

The session route becomes a single stepper component (`step: "setup" | "checkin" | "roster" | "done"`) that derives the current step from schedule status + check-in state, so a refresh resumes correctly. Back arrow returns to `/ground`.

### Screen 2 — Today's Timetable (`/ground/index.tsx`)
- Keep header from `ground.tsx` shell. Rename page heading to "Today's Schedule".
- Each session card shows time block (left), module + venue (center), status chip (right). Tap → `/ground/$scheduleId`.
- Keep the existing 3-stat grid (Today / Done / Upcoming) and the "View Full Schedule" dialog (already in code via `setScope`).

### Screen 3 — Session Context Setup
Replace the current monolithic detail page. When `status !== ACTIVE && !checkedIn`:
- **System Data (Read-only)** card: Department, Level, UC/Module, Module Code, Total Hrs, Total Sessions, Session Number (of target) — pulled from `getScheduleDetail` + `getMyProgress` + a new lightweight read of department/level names already returned by joined queries on `schedules`.
- **Manual Entry (Required)** card: Mode selector (Theory / Practical / Both — calls `setSessionMode`), Session Plan textarea, Learning Outcome textarea (saved locally, sent on End).
- Primary CTA: "Proceed to Check-In" — disabled until mode + plan(≥5) + outcome(≥5) are set. Tapping advances to Screen 4.

### Screen 4 — Session Started (Check-In)
- Large circular **CountdownTimer** (reuse component, restyled as ring) showing minutes until attendance window opens / closes.
- Geo status row: "Geo-Fence check: Active / Bypassed / Outside" with current distance.
- "Check-In Location" button (calls `trainerCheckIn`); disabled outside the 10-min-before → 20-min-after start window or when `!inRadius` (respecting global `geofence_enabled` + per-trainer bypass already wired).
- On success → Screen 5.

### Screen 5 — Active Attendance Window
- Top status strip: Attendance window remaining (CountdownTimer to `roster_unlock_until`), GPS status pill ("On Campus" / "Outside").
- Student table: rows with name + two checkboxes (Present / Absent — mutually exclusive). "Mark all present" quick action.
- "Submit Attendance" button → `enqueueSessionBatch` + `flush` (existing offline pipeline).
- "End Session" button (visible after submit OR when end-window opens, current 10-min-before-end logic preserved); calls `trainerEndSession`.

### Screen 6 — Session Completed
When `status === ENDED`:
- Big green check + "SUCCESS!" headline.
- Summary card: "Session N Summary — {module_name}", "{present} Present, {absent} Absent of {total} Expected".
- Lesson Plan card (read-only echo of submitted plan).
- "Return to Home" button → `/ground`.

### UX details to match the mockup
- Mobile-first single column, max-w-md (already set in shell).
- Section cards use existing `Card` with rounded-2xl, soft borders.
- Status colors via semantic tokens (`emerald`, `amber`, `rose` already in `styles.css`).
- Back arrow in screen 3-6 returns to `/ground`.

### Files touched
- `src/routes/_authenticated/ground/index.tsx` — refine list/header copy only.
- `src/routes/_authenticated/ground/$scheduleId.tsx` — full rewrite into stepper with 4 sub-views (Setup, CheckIn, Roster, Done).
- `src/components/countdown-timer.tsx` — add an optional `variant: "ring"` for the large circular timer on screen 4.
- `src/lib/trainer.functions.ts` — extend `getScheduleDetail` to also return department name, level name, and session number/target (single extra join, no schema change).

### Out of scope
- No DB migrations, no auth changes, no changes to login/branding, no changes to DH/MA screens.
