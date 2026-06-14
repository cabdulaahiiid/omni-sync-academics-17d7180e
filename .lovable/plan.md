
# TVET ERP — 2026 Enterprise Command Center Redesign (Single Delivery)

One implementation pass. UI/UX only. Zero backend, schema, RLS, route path, or sidebar item changes. Every existing menu, permission, server function, and workflow stays exactly as is.

## Scope guarantee

- Keep every sidebar item, route path, server function, RLS policy, and table.
- Only touch presentation files: shells, dashboards, shared UI primitives, design tokens.
- Reuse existing server functions in `src/lib/*.functions.ts` for all live data. No new tables. No new RPCs.
- One delivery. No phases. No TODOs. No placeholders.

## 1. Design system upgrade (`src/styles.css`)

Add enterprise tokens layered on top of existing shadcn tokens (no removals):

- Brand: `--nav-bg: #071A52`, `--nav-bg-2: #0A2472`, `--nav-active: #1E88FF`, `--nav-active-glow`, `--nav-fg`, `--nav-fg-muted`.
- Surfaces: refine existing `--surface-raised` / `--surface-sunken`; add `--surface-elevated`, `--surface-inset`, `--ring-focus`.
- Status: `--status-ok`, `--status-warn`, `--status-crit`, `--status-info` + `-fg` pairs.
- Typography scale: `--font-display`, tightened tracking for headings, tabular-nums for KPI values.
- Motion: `--ease-fluent`, durations 120/180/240ms.
- Add `@utility` helpers: `kpi-counter`, `glow-active`, `card-elevated`, `row-hover`, `skeleton-shimmer`.
- Add keyframes: `count-up`, `pulse-soft`, `slide-fade-in`, `shimmer`.

All tokens are additive; no existing class breaks.

## 2. Sidebar (Strategic + Operational shells)

Files: `src/components/strategic/strategic-shell.tsx`, the operational shell, and any nav data file they consume.

Preserved exactly (labels, routes, order):
- Core Operations: Command Center, Insights, Approvals, Audit Logs
- Academic & Structure: Departments, Modules, Venues, Levels, Sections, Semesters
- User Management: Department Heads, Trainers, Students, Users & Roles
- Governance: Reports, System Data, Settings

Visual + behavior upgrades only:
- Navy gradient background using `--nav-bg` → `--nav-bg-2`.
- Active item: left accent bar + soft glow (`box-shadow` using `--nav-active-glow`), 180ms ease.
- Group headers collapsible (Radix Collapsible), persisted in `localStorage` per role.
- Icon refresh using existing `lucide-react` set (no new deps); 18px stroke 1.75.
- Hover: subtle background lift + 1px translate.
- Notification badges on Approvals (pending count) and Audit Logs (today count) via existing `dashboardInsights` / `listApprovalQueue` counts.
- Collapse toggle (icon-only mode) using shadcn sidebar `collapsible="icon"`; width via `var(--sidebar-width)` to avoid the TW4 sidebar bug.
- Sidebar search: client-side fuzzy filter over the same nav array; jumps via `<Link>`.
- Recent pages: track last 5 visited routes in `localStorage` via a router subscription in the shell.
- Favorites: star toggle per item, persisted in `localStorage`.
- Quick Actions block at bottom: deep-links to existing routes (New Semester → `/strategic/semesters`, Submit Approvals → `/strategic/approvals`, Upload Schedule → `/operational/semester-upload`, etc.). No new actions invented.

## 3. Top navigation bar

A new `TopBar` rendered inside both shells (replacing current thin header):
- Left: sidebar trigger, breadcrumb (existing `breadcrumbs.tsx`).
- Center: global search (filters the same nav + opens routes).
- Right: theme toggle, `NotificationsBell` (existing component), `Help`, user menu (uses existing `useMe` + `supabase.auth.signOut`).
- Sticky, backdrop-blur, 56px, divider hairline.

## 4. Command Center (Strategic) — `src/routes/_authenticated/strategic/index.tsx`

Full rebuild of the page composition; data sources are existing server fns in `src/lib/dashboard.functions.ts` and `src/lib/ma.functions.ts` (`getStrategicStatsExt`, `getApprovalQueueSummary`, `getInstitutionActivity`, `getDepartmentPerformance`, `listLiveActivityFeed`, `dashboardInsights`, `listSemesters`).

### Header band
- Greeting: "Good {morning|afternoon|evening}, {profile.full_name}" from `useMe`.
- Institution Overview chips: Academic Year + Active Semester (from `listSemesters` where `status='ACTIVE'`), Last Sync (current time, refreshed on query refetch), Active Session count (from stats).
- Right: **Institution Health Score** card. Score = weighted blend of attendance %, approval-clearance %, geo-compliance %, trainer-active %, all from existing stats. Show %, trend arrow vs previous fetch (cached in `localStorage`), status badge (Excellent/Good/Watch/Critical), "Weekly change" using 7-day series from `getDepartmentPerformance` aggregate.

### Row 1 — 8 KPI tiles (`KpiTile`)
Total Students, Total Trainers, Departments, Active Modules, Pending Approvals, Attendance Today, Active Classes, Venue Utilization. Each: icon, value (animated count-up), % delta, sparkline. All values from existing fns; for any metric not already returned, derive client-side from already-fetched lists (e.g., venue utilization = activeSessions / totalVenues). No new server fns.

### Row 2 — Analytics (3 cards)
- Attendance Trend: tabs Daily / Weekly / Monthly, Recharts area chart over `getDepartmentPerformance` series aggregated.
- Student Distribution: tabs Department / Level / Semester, Recharts donut from existing counts (group client-side).
- Department Performance Ranking: horizontal bar chart with Attendance, Completion, Trainer-perf columns (already provided by `getDepartmentPerformance`).

### Row 3 — Operations (3 cards)
- Critical Alerts: list using `AlertRow`, fed by existing alert sources (missing attendance from `listLiveActivityFeed` gaps, unapproved from approval queue counts, inactive trainers from trainer registry status, missing timetables from schedules without sessions). Each alert deep-links to the relevant route with query filter.
- Approval Queue: top 5 pending from `listApprovalQueue({decision:'pending'})` with inline Approve/Reject buttons calling existing `decideApproval` — full functionality preserved, just restyled.
- Today's Academic Activities: today's sessions from existing schedules query filtered by date — class, venue, trainer, time.

### Row 4 — Institution Management (3 cards)
- Department Overview table: Department / Students / Trainers / Modules / Attendance / Performance Score using `getDepartmentPerformance` + counts. Sortable, sticky header, row-click → `/strategic/departments/$id`.
- Recent Activities Feed: existing `ActivityRow` x `listLiveActivityFeed`.
- Audit Trail: latest 10 from `audit_logs` via existing query used by `/strategic/audit` (reuse server fn), row-click → audit detail.

### AI Insights Panel
Pure derivation from already-fetched data (no LLM call, no new secret):
- "Departments requiring attention" (lowest performance + alerts count).
- "Attendance anomalies" (today vs 7-day mean > 1.5σ).
- "Trainer performance trends" (rank deltas).
- "Student enrollment trends" (semester-over-semester from `listSemesters` + students count).
- "Resource utilization" (venue + trainer load).
Each insight is a card with severity chip and deep-link CTA.

### Reporting widgets strip
Footer strip: Total Departments/Trainers/Students/Modules/Venues/Sections/Semesters as compact stat chips (existing counts).

## 5. Operational (DH) Command Center — `src/routes/_authenticated/operational/index.tsx`

Same visual system, scoped to the DH's department using existing `getDHStatsExt`, `listDHScheduleCommand`, `listDHAttendanceMonitor`. Keep current Schedule Command Center; restyle to new tokens, add KPI row, alerts, activities, insights — all from existing DH server fns.

## 6. Shared primitive upgrades

- `src/components/erp/kpi-tile.tsx`: add animated count-up (CSS + `requestAnimationFrame`), tabular-nums, focus ring, skeleton state.
- `src/components/erp/dashboard-section.tsx`: add optional `tone` + collapsible.
- `src/components/erp/alert-row.tsx`, `activity-row.tsx`: density variants, severity chip, keyboard focus styles.
- New `src/components/erp/health-score-card.tsx`, `top-bar.tsx`, `quick-actions.tsx`, `sidebar-search.tsx`, `favorites-store.ts`, `recent-pages-store.ts`, `ai-insights-panel.tsx`, `reporting-strip.tsx`, `chart-card.tsx`.

## 7. Responsiveness, motion, a11y

- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8` for KPI row; analytics row `lg:grid-cols-3`; uses `min-w-0` + `grid-cols-[minmax(0,1fr)_auto]` on all header rows (per responsive-layout rule).
- Mobile sidebar: shadcn `Sheet` already wired; verified collapse + offcanvas.
- Motion: `animate-fade-in`, `animate-scale-in`, count-up; respects `prefers-reduced-motion`.
- A11y: every icon button gets `aria-label`; tap targets ≥ 44px on mobile primary actions; semantic `<main>` single per route; tokens used (no hardcoded colors); focus-visible rings via `--ring-focus`.

## 8. Theme

- Light + dark both retuned for the new navy/accent system using `@theme inline` mapping; `class="dark"` continues to drive dark mode.

## 9. Out of scope (explicit)

- No sidebar item add/remove/rename.
- No new routes, no new tables, no new RPCs, no new secrets, no new edge functions, no AI Gateway calls.
- No changes to Approvals workflow, System Data destructive flows, Conflict Resolution Panel, or Feedback Chat behavior (only restyle to new tokens).
- No `tailwind.config.js` (Tailwind v4 — tokens go in `src/styles.css`).

## Technical notes

- All new components are presentation-only. Data via `useServerFn` + `useQuery` against existing fns. React Query `staleTime` 30s (already configured); add `refetchInterval: 60_000` on Command Center queries for "real-time" feel.
- Sidebar width fix: use `w-[var(--sidebar-width)]` explicitly (TW4 caveat).
- Charts: existing `recharts`. No new chart libs.
- Animations: CSS keyframes + existing animate utilities. No `framer-motion` added.
- LocalStorage keys namespaced `tvet:sidebar:*`, `tvet:health:prev`.
- Verification after build: load `/strategic` and `/operational` in preview, confirm all KPIs render with live counts, approvals approve/reject still calls `decideApproval`, sidebar nav unchanged in labels/routes.

## Files touched

Edited:
- `src/styles.css`
- `src/components/strategic/strategic-shell.tsx`
- `src/routes/_authenticated/strategic/index.tsx`
- `src/routes/_authenticated/operational/index.tsx`
- `src/routes/_authenticated/operational.tsx` (shell, if it owns nav)
- `src/components/erp/kpi-tile.tsx`
- `src/components/erp/dashboard-section.tsx`
- `src/components/erp/alert-row.tsx`
- `src/components/erp/activity-row.tsx`

Created:
- `src/components/erp/top-bar.tsx`
- `src/components/erp/health-score-card.tsx`
- `src/components/erp/quick-actions.tsx`
- `src/components/erp/sidebar-search.tsx`
- `src/components/erp/ai-insights-panel.tsx`
- `src/components/erp/reporting-strip.tsx`
- `src/components/erp/chart-card.tsx`
- `src/lib/ui/favorites-store.ts`
- `src/lib/ui/recent-pages-store.ts`
- `src/lib/ui/health-score.ts`

No migrations. No deletions. No sidebar item changes. No backend changes.
