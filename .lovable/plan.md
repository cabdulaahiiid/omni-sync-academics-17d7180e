
# Dashboard Layout Optimization — Command Center Shell

Layout, spacing, and information-architecture only. No backend, query, RLS, or widget-logic changes. All existing widgets, server functions, and data hooks stay intact — they're just reflowed into a denser, fixed-shell grid.

## 1. App shell: fixed sidebar + fixed header + scrollable content

Files: `src/routes/_authenticated/strategic.tsx`, `src/routes/_authenticated/operational.tsx`, and the shared `strategic-shell.tsx` / operational shell.

- Outer container: `h-screen overflow-hidden flex` (locks page to viewport).
- Sidebar: `h-screen sticky top-0 shrink-0` — stops scrolling with the page.
- Right column: `flex-1 flex flex-col min-w-0`.
  - Sticky header (existing top bar): `sticky top-0 z-30 bg-background/85 backdrop-blur border-b`. Contains existing search, notifications bell, user profile.
  - `<main>` becomes the **only** scroll container: `flex-1 overflow-y-auto`.
- Content max width: `max-w-[1600px] mx-auto px-4 lg:px-6 py-4`.
- Remove the current per-page `sticky top-0 -mx-4 -mt-4 ...` header bars inside `strategic/index.tsx` and `operational/index.tsx`; their title + refresh button move into a slim in-page bar that is **not** sticky (the app header already is).

## 2. Compact KPI strip (Row 1, ≤120px tall)

Files: `src/components/erp/kpi-tile.tsx`, `strategic/index.tsx`, `operational/index.tsx`.

- Add a `compact` variant to `KpiTile`:
  - Single row: `flex items-center gap-3 p-3` (was stacked `p-4`+sparkline).
  - Icon 32px chip, label `text-[11px]`, value `text-xl font-semibold`, delta inline, sparkline hidden at compact size (or rendered as a 24px-tall mini line on `xl:` only).
  - Total tile height ~96px → row fits under 120px including section header.
- Grid: `grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3`.
- Row wrapper is **sticky** under the app header: `sticky top-0 z-10 bg-background/85 backdrop-blur -mx-* px-* py-2`.

## 3. Row 2 — Schedule (70%) + Side rail (30%)

- Wrapper: `grid grid-cols-1 lg:grid-cols-10 gap-4`.
  - Schedule card: `lg:col-span-7`.
  - Side rail: `lg:col-span-3 flex flex-col gap-3`.
- **Schedule table internal scroll**: card body becomes `max-h-[500px] overflow-y-auto`; `TableHeader` gets `sticky top-0 bg-[var(--surface-sunken)] z-10`. Page no longer grows with row count.
- Side rail stacks (top→bottom): **Actions panel** (existing selected-row actions), **Live Alerts** (existing alerts card, condensed), **Approval / Draft status** (small status block derived from existing `kpi.pending_reviews` + approval queue counts already fetched — no new queries).
- Remove the standalone full-width "Department Alerts" section at the bottom — it now lives in the side rail.

## 4. Row 3 — Active Classes (50%) + Attendance Monitoring (50%)

- `grid grid-cols-1 lg:grid-cols-2 gap-4` — always side-by-side from `lg:` up.
- Each card: header `py-2`, body `p-3`, list items `py-2` (down from `p-3`). Internal `max-h-[320px] overflow-y-auto` so long lists don't stretch the row.

## 5. Row 4 — Three analytics columns

- `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
- **Attendance Analytics**: existing `analytics` LineChart, height reduced to `h-56`.
- **Trainer Compliance**: reuse existing department-performance data already returned by `getDepartmentPerformance` (MA) / derive from `kpi` punctuality field (DH) — display as a compact horizontal bar list, no new server fn.
- **Schedule Analytics**: small bar/area from the same `analytics` series (completion vs scheduled). Pure presentation re-use of data already on the page.

## 6. Spacing + density pass

Global to both dashboards:
- Section gap: `space-y-6` → `space-y-4`.
- `Card` padding: header `pb-2 pt-3 px-3`, content `p-3` (was `p-4`).
- `DashboardSection` title row tightened: `mb-2`, description `text-[10px]`.
- Table row height: `h-11` → `h-9`, cell text `text-xs`, header `text-[10px]`.
- Remove every `mt-6` / `mb-6` between rows in favor of grid `gap-4`.

## 7. Responsive rules

- `< md` (mobile): every grid collapses to 1 column; KPI strip 2-up; sidebar uses existing `collapsible="offcanvas"` behavior (untouched).
- `md` (tablet): KPI 3-up, Rows 2/3 stack, Row 4 2-up.
- `lg`+ (desktop): full 12-col command-center layout described above.
- No horizontal scroll anywhere; tables get `overflow-x-auto` only inside their fixed-height container.

## 8. Files touched (layout only)

- `src/routes/_authenticated/strategic.tsx` — shell: fixed sidebar/header, single scroll container.
- `src/routes/_authenticated/operational.tsx` — same shell treatment.
- `src/routes/_authenticated/strategic/index.tsx` — re-grid into Rows 1–4, drop in-page sticky bar, condense sections.
- `src/routes/_authenticated/operational/index.tsx` — same re-grid (this is the file shown in context).
- `src/components/erp/kpi-tile.tsx` — add `compact` variant.
- `src/components/erp/dashboard-section.tsx` — tighter title row.
- `src/styles.css` — optional: add `--space-xs/sm/md` tokens (8/16/24) for the consistent spacing scale; no token renames.

## 9. Explicitly NOT changing

- No edits to `src/lib/dashboard.functions.ts`, `approvals.functions.ts`, `dh-extras.functions.ts`, migrations, RLS, auth, or any query/queryKey.
- No changes to `KpiTile` data props, `AlertRow`, `ActivityRow`, `approval-chat-dock`, `approval-version-timeline`, or matrix/conflict panel.
- Sidebar contents and routes unchanged; only its container becomes `h-screen sticky`.
- Approvals page (`strategic/approvals.tsx`) left alone unless the user also wants it densified.

## Acceptance check (manual)

- Sidebar + header stay in place while main scrolls.
- On 1440×900, first viewport shows: header, KPI strip, top of schedule table, side-rail actions, first row of live monitoring — no scroll required.
- Schedule rows scroll inside the card; total page height ≤ ~2 viewports even with 100+ sessions.
- All existing buttons, links, refresh, realtime subscriptions still work (untouched code paths).
