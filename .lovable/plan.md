# Trainer Mobile App — UI/UX Overhaul (Scoped)

Strict scope: only files under `src/routes/_authenticated/ground/*`, the trainer shell (`ground.tsx`), the trainer profile view when accessed by trainers, and trainer-only components. **No changes** to Admin (strategic), Department Head (operational), auth, RBAC, RLS, database schema, server functions, or any shared business logic.

## Design System (trainer-only tokens)

Add a scoped stylesheet / trainer theme wrapper (does not affect other shells):
- Primary Navy `#123E7C`, Secondary Emerald `#16A34A`, Accent Sky, Amber `#F59E0B`, Danger `#DC2626`, BG `#F8FAFC`.
- 16px radius, 56px primary buttons, Material Symbols Rounded (via CDN link in trainer shell only).
- Typography scale: 24 bold header / 18 semibold section / 16 body / 14 caption.

## Screens (all under `/ground`)

1. **Shell / Home** (`ground/index.tsx`) — top app bar with greeting + trainer name + bell, "Today's Sessions (N)" heading, session cards (module, code, dept, level, section, room, time, status badge). Each card: `VIEW` (always enabled) + `START SESSION` (enabled only within 20 min before start; otherwise shows live "Available in HH:MM:SS" using existing server-time offset). Bottom nav: Home / Completed / Profile.
2. **Session Details** (`ground/$scheduleId.tsx` — pre-start state) — auto-generated info block (dept, level, section, module, hours, total sessions, current/remaining, room, time) + manual inputs (students expected, mode dropdown Practical/Theory, learning outcome, lesson plan) + START SESSION.
3. **Geofence Verification** — animated GPS check, distance vs allowed radius, verified/outside states, offline continue option. Reuses existing `useGeoGatekeeper` and geofence bypass rules — no logic changes.
4. **Live Session** — big circular countdown using server-synced time (existing `getServerTime` + offset), status cards (Started/GPS/Sync/Location), progress bar, Attendance button that activates in last 15 min.
5. **Attendance** — searchable student list with Present/Absent checkboxes, live Present/Absent/% summary, SUBMIT.
6. **Attendance Summary** — large summary cards + Continue.
7. **Session Report** — full report preview + Download PDF (reuses existing report export) + Share + Finish.
8. **Session Completed** — success animation + checklist + HOME / VIEW REPORT.
9. **Completed Sessions** (`ground/completed.tsx`, new route) — list of the trainer's completed sessions with View Report / Download PDF.
10. **Profile** (`ground/profile.tsx` or reuse `/profile` styled for trainer) — photo, name, dept, email, phone, offline sync status, app version, logout.

Bottom nav appears on Home/Completed/Profile; hidden inside an active session flow.

## Offline & Auto-End

- Reuse existing offline queue (`src/lib/offline/*`) and `OfflineBanner`. Add trainer-styled banner variants (Offline / Waiting / Syncing / Synced / Failed) — presentation only.
- Auto-end: rely on existing server-side rule; UI simply displays "Auto Ended" badge on completed cards when applicable. No server changes.

## What this plan will NOT touch

- No changes to `strategic/*`, `operational/*`, `_authenticated.tsx`, `login.tsx`, auth provider, `use-me`, RBAC helpers, semester builder, approvals, admin/DH server functions, DB migrations, RLS, or shared components used by other shells.
- No new server functions or schema; UI wires only to existing trainer endpoints (`getTrainerToday`, `getScheduleDetail`, `setSessionMode`, `trainerCheckIn`, `submitSessionBatch`, `trainerEndSession`, `getMyProgress`, `getServerTime`, `getTrainerSessionsDetailed`).

## Technical notes

- New files: `src/components/trainer/*` (BottomNav, SessionCard, CountdownRing, StatusChip, GeofenceCheck, AttendanceList, ReportPreview, SuccessScreen, TrainerThemeProvider), `src/routes/_authenticated/ground/completed.tsx`, `src/routes/_authenticated/ground/profile.tsx`.
- Edited files: `src/routes/_authenticated/ground.tsx` (shell restyle + bottom nav + theme wrapper), `src/routes/_authenticated/ground/index.tsx` (new home layout), `src/routes/_authenticated/ground/$scheduleId.tsx` (full flow refactor into stepper: Details → Geofence → Live → Attendance → Summary → Report → Completed).
- Material Symbols font loaded via `<link>` inside trainer shell only, so admin/DH pages remain untouched.

## Deliverables

A single cohesive trainer-only mobile experience matching the 12-screen spec, using only existing backend endpoints and existing role/permission model.
