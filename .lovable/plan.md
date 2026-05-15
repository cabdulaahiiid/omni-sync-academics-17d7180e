# Iteration Plan — Phase 2 + Phase 3 (Master Admin)

Following your mockup as the visual target. Trainer PWA, DH operational portal, real-time sync, offline queue, and analytics ship in later iterations.

## 1. Phase 2 — Auth & Role Routing

- Rename `/admin` → `/strategic`, `/dh` → `/operational`, `/trainer` → `/ground`. Sidebar links and `_authenticated` guards updated accordingly.
- Update `/login` page:
  - Header: "TVET OMNI-SYNC ERP" + tagline "Institutional Secure Portal"
  - On successful sign-in, fetch `user_roles.role` and redirect: MA→`/strategic`, DH→`/operational`, T→`/ground`.
  - Show "Invalid credentials" on auth error, "No role assigned — contact administrator" if user has no role row.
- Keep first-signup→MA bootstrap trigger from foundation.

## 2. Phase 3 — Strategic Command Center (`/strategic`)

Dashboard matches your mockup (navy sidebar, white surface, colored stat cards):

**KPI cards (top row, 5 across, responsive grid):**
- Active Sessions — count of `schedules` where `status='LIVE'` and today
- Geo Compliance % — `session_logs.geo_verified=true / total today`
- Trainer Punctuality % — sessions started within attendance_window
- Attendance % — present logs / total logs (last 7d)
- Pending Approvals — `schedules.status='PENDING'` count

**Widgets (2-column below KPIs):**
- Approval Queue — list of pending schedules with conflict badges (from `approval_queue` table flags), Approve / Send Back actions
- Live Activity Feed — last 20 `audit_logs` entries with actor/action/entity
- Department Comparison — bar chart (Recharts) of per-department attendance rates
- Override Logs — last 10 `attendance_overrides` with reason

All data fetched via `createServerFn` + `requireSupabaseAuth`, wrapped in TanStack Query with 30s `staleTime`. Realtime subscription on `audit_logs` and `schedules` to invalidate queries (Supabase Realtime, replacing Firestore listeners).

## 3. WF1 — Department & DH Management

- `/strategic/departments` — already built; add status badge + soft-delete (status=ARCHIVED).
- `/strategic/department-heads` — new page:
  - List existing DH assignments (join `department_heads` × `profiles` × `departments`).
  - "Create DH Account" dialog: email + full_name + department dropdown. Server fn:
    1. Calls `supabaseAdmin.auth.admin.createUser({ email, password: temp, email_confirm: true })`
    2. Inserts into `user_roles` (role='DH'), `profiles` (department_id), `department_heads`.
    3. Returns the temp password to display once (admin shares with DH).
  - Reassign / revoke buttons.
  - Every mutation writes an `audit_logs` row.

## 4. WF2 — Module Registry (bulk Excel upload)

- `/strategic/modules` — list view with filters by department/level/status.
- "Bulk Upload" dialog:
  - Accept `.xlsx` via `<input type="file">`.
  - Parse client-side with `xlsx` (SheetJS) — defer server parsing.
  - Expected columns (sensible default; documented in dialog + downloadable template button):
    `code | name | department_name | level_name | type | qualifications | total_hours | total_sessions`
    - `qualifications` = comma-separated string → `text[]`
    - `type` ∈ `Theory | Practical | Both`
    - `level_name` resolved against `levels` (per department), `department_name` against `departments`.
  - Preview table with row-level validation (red badge for unresolved FKs, duplicates).
  - "Confirm Upload" calls server fn that bulk-inserts valid rows in a single transaction; returns `{ inserted, skipped, errors[] }`.
- Manual "Add Module" form retained.
- Audit log entry per upload batch.

## 5. WF3 — Approval Engine

- Server function `checkScheduleConflicts(schedule_id)`:
  - **Trainer overlap** — same `trainer_registry_id`, same `date`, time window intersects.
  - **Venue overlap** — same `venue_id`, same `date`, time window intersects.
  - **Invalid qualification** — module's `qualifications[]` ∩ trainer's `trainer_skills.module_code` empty.
  - **Excessive load** — trainer scheduled >8h on same day or >40h same week.
  - Writes/updates `approval_queue` row with the four boolean flags.
- Approval Queue widget on dashboard shows conflict chips per schedule.
- Actions:
  - **Approve** → `schedules.status='LIVE'`, audit log, realtime fan-out (Phase 6 hook stubbed for now).
  - **Send Back** → dialog for `admin_feedback`, `schedules.status='FEEDBACK_REQUIRED'`.
- Schedules table is mostly empty in v1 — we'll populate via WF6 (semester upload) in the next iteration; for now, conflict-detection logic is wired and tested against any manually-inserted rows.

## 6. Visual System (matching your mockup)

- Sidebar: navy `#1e2a47`, white text, active item with subtle accent strip.
- KPI cards: white surface, colored left border per metric (uses semantic tokens already in `src/styles.css`).
- Tables: Shadcn `Table` + sortable headers, row hover, pagination at 25.
- Empty states with icon + CTA on every list page.
- Toasts via Sonner for all mutations.

## 7. Out of Scope (next iterations)

| Iteration | Contents |
|---|---|
| **Next** | DH Operational Center, WF4 Trainer registry (with hidden_staff_id mapping), WF5 Student bulk upload, WF6 Semester upload + 16-week auto-slice |
| **Then** | Trainer PWA: WF9 timetable, WF10 geo gate, WF11 attendance sheet, WF12 session completion |
| **Then** | Phase 6 realtime fan-out, Phase 7 offline queue (IndexedDB + sync) |
| **Then** | WF7 Quick Swap, WF8 Attendance Override (24h window), Phase 8 audit UI, Phase 9 reports |

## Technical Notes

- Routes renamed by moving `src/routes/_authenticated/admin/` → `_authenticated/strategic/` and updating `createFileRoute` paths. `routeTree.gen.ts` regenerates on save.
- All server functions follow `createServerFn().middleware([requireSupabaseAuth]).inputValidator(zod).handler(...)` pattern, with `attachSupabaseAuth` already wired in `src/start.ts`.
- Excel parsing uses `xlsx` npm package (browser-side) — fits Worker constraints since we never parse on the server.
- Realtime: subscribe in `useEffect` inside dashboard component, invalidate TanStack queries on `postgres_changes` events.
- No new tables needed — schema from foundation already covers everything.

Reply with **Approve** to start, or tell me what to adjust.