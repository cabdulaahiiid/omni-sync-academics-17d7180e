
# Finish remaining 2026 Command Center work

The Strategic shell + Strategic Command Center are complete (HealthScore, KPIs, AI Insights, Analytics, Live Feed, Reporting Strip, Quick Actions, favorites, recent, sidebar search, badges, breadcrumbs, user menu). The pieces that were started but not finished all live on the **Operational (DH) side** and a couple of shared deep-link affordances. Nothing finished will be touched.

## Locked (do not modify)
- `src/styles.css` design tokens
- `src/components/strategic/strategic-shell.tsx`
- `src/routes/_authenticated/strategic/index.tsx` and every existing strategic route
- `health-score-card.tsx`, `ai-insights-panel.tsx`, `reporting-strip.tsx`, `kpi-tile.tsx`, `dashboard-section.tsx`, `alert-row.tsx`, `activity-row.tsx`
- All server functions, RLS, sidebar items, route paths, approval / chat / system-data flows

## 1. Operational shell parity — `src/routes/_authenticated/operational.tsx`
Bring the DH shell up to the same enterprise behavior the Strategic shell already has. Same tokens, same patterns, no new design.

- Favorites: star toggle per nav item, persisted via existing `favorites-store.ts`; show "Favorites" mini-section above the main nav (collapsed-state: dot only).
- Recent pages: render top 3 from `getRecentPages()` in a "Recent" mini-section (already pushing into store; only the render is missing).
- Live badges on nav items:
  - `Drafts`: pending DH submissions count via existing `getDHStatsExt().pending_reviews`.
  - `Attendance`: missing-attendance count via existing `getDHStatsExt().missing_attendance`.
  Reuse the same red glow pill style used in strategic-shell `SidebarItem`.
- Top bar: add the same Quick Create `+` dropdown found in strategic-shell, scoped to DH actions that already exist:
  - New Schedule → `/operational/semester-upload`
  - Submit Draft → `/operational/drafts`
  - Take Attendance → `/operational/attendance`
  - Open Timetable → `/operational/matrix`
- Top bar: add the same global search input (visual only, focus highlights) used in strategic, so both shells look identical.
- User menu dropdown (avatar) with full name + role + Sign out — currently DH shell has no avatar/user menu.

## 2. DH Command Center — `src/routes/_authenticated/operational/index.tsx`
Reach feature parity with the Strategic dashboard composition using only existing DH server fns (`getDHStatsExt`, `listDHAlerts`, `getDHAnalytics`, `listDHActiveClasses`, `listDHAttendanceMonitor`, `listDHScheduleCommand`).

Add, in this order, after the existing Department Analytics section:
- **AI Insights Panel** (`AIInsightsPanel`) — derive insights purely from already-fetched DH data:
  - Weekly attendance trend dip > 10% from `analyticsQ`.
  - Punctuality leader vs laggard from `analyticsQ`.
  - Pending reviews backlog from `kpi.pending_reviews`.
  - Missing-attendance pressure from `kpi.missing_attendance`.
  Each insight deep-links to the existing DH route with appropriate filter (`?status=pending`, `?missing=1`, etc.).
- **Reporting strip** (`ReportingStrip`) at the bottom — department-scoped tiles built from already-fetched data:
  - Active Today, Pending Reviews, Submitted, Missing, Late, Weekly Compliance — each linking to its existing DH route.
- **Quick Actions** section mirroring strategic dashboard: deep-links to `/operational/drafts`, `/operational/attendance`, `/operational/matrix`, `/operational/live-monitor`, `/operational/semester-upload`, `/operational/reports`.

## 3. Deep-link filters consumed by existing routes
Some new deep-links above pass query params (`?status=pending`, `?missing=1`) that the destination routes do not yet read. Wire **read-only** support in the existing routes:
- `src/routes/_authenticated/operational/drafts.tsx` — if `search.status === "pending"`, set the existing status filter to Pending on mount.
- `src/routes/_authenticated/operational/attendance.tsx` — if `search.missing === "1"`, set the existing missing-only toggle on mount.
- `src/routes/_authenticated/strategic/approvals.tsx` — same `?status=pending` pre-filter (used by sidebar badge / AI insight CTA).

No new server fns, no schema changes — only `Route.useSearch()` → existing setState call.

## 4. Responsiveness + a11y polish on the new operational pieces
- KPI / Reporting strip grid uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` with `min-w-0` cells.
- Sidebar star button has `aria-label`, `aria-pressed`.
- Quick Create dropdown has `aria-label`.
- All new tap targets ≥ 36×36.
- Honor `prefers-reduced-motion` (reuse existing utility classes).

## Out of scope (explicit, not changed)
- No new server functions, no migrations, no RPC changes, no new secrets.
- No sidebar item add/remove/rename.
- No changes to Strategic shell, Strategic Command Center, Approvals workflow, Chat dock, System Data, Conflict Resolution Panel, theme tokens.
- No new standalone `top-bar.tsx` / `quick-actions.tsx` / `sidebar-search.tsx` / `chart-card.tsx` files — the equivalent logic already lives inside the shells; refactoring is unnecessary and would risk regressions on finished work.

## Files touched
Edited:
- `src/routes/_authenticated/operational.tsx`
- `src/routes/_authenticated/operational/index.tsx`
- `src/routes/_authenticated/operational/drafts.tsx`
- `src/routes/_authenticated/operational/attendance.tsx`
- `src/routes/_authenticated/strategic/approvals.tsx`

Created: none.

## Verification after build
- `/operational` shows Favorites, Recent, live badges on Drafts/Attendance, Quick Create dropdown, avatar/user menu.
- DH dashboard shows AI Insights panel and Reporting strip with live counts; existing sections untouched.
- Clicking the Drafts badge / AI Insight CTA opens `/operational/drafts?status=pending` with the Pending filter pre-applied.
- `/strategic` page and every existing strategic route render identically to before.
