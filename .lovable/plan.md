# TVET OMNI-SYNC — Master Admin UI Redesign

Scope: visual/structural redesign only. No backend, schema, route, or data-fetching changes. All existing server functions, queries, and routes stay intact.

## 1. Sidebar (`src/components/strategic/strategic-shell.tsx`)

Convert the flat 16-item nav into a strict **accordion** grouped into 4 collapsible sections. Only one group open at a time; the group containing the active route auto-expands on load.

Groups:
- **Core Operations** — Command Center, Insights, Approvals, Audit Logs
- **Academic & Structure** — Departments, Modules, Venues, Levels, Sections, Semesters
- **User Management** — Department Heads, Trainers, Students, Users & Roles
- **Governance** — Reports, Settings

Styling:
- Dark slate-blue background (use existing `--sidebar` token, tune toward slate-blue in `src/styles.css` if needed).
- Profile block (avatar + name + "Master Admin" subtitle) pinned top-left under the brand.
- Group header rows: uppercase micro-label, right-facing chevron rotating to down when open, smooth height transition.
- Active sub-link: subtle white/10 pill, 8px radius, left accent bar.
- Sign-out pinned to bottom.

## 2. Top Bar

Replace the current "Master Administrator / name" header with:
- Wide **search input** (placeholder "Search wide search…") taking most of the bar, leading `Search` icon, 8px radius, soft border.
- `NotificationsBell` with red badge (already supported).
- Teal **quick-action `+` button** (rounded, primary-teal, soft shadow) — opens a dropdown stub (no logic wired; menu items can be placeholders linking to existing create flows like New Department / New Module / New Venue).

## 3. Command Center (`src/routes/_authenticated/strategic/index.tsx`)

Background: `bg-slate-50` (#F8FAFC).

**Row 1 — 5 compact metric cards** (one per existing KPI):
- Large numeric value, small uppercase label, tinted icon chip.
- Inline **sparkline** (recharts `LineChart` with hidden axes, ~40px tall) — for now feed each card a small synthetic 7-point series derived from the current value (placeholder visualization, no new backend).
- Trend **pill badge** (green ↑ or red ↓ with %); placeholder deltas computed client-side.
- White card, soft shadow, 8px radius, no left accent stripe (cleaner than current).

**Row 2 — split**:
- Left: **Approval Queue** rendered as a real `Table` (shadcn) with columns Module · Trainer · Date · Status · Actions. Status column uses badges (`Pending`, `Returned`, conflict chips). Keep existing approve / send-back mutations.
- Right: **Department Performance** card with tabs (Attendance / Punctuality / Load). Default shows a combined `ComposedChart` — bars for attendance, overlay line for punctuality — using existing `getDepartmentComparison` data plus client-derived second series. Legend chips for ICT, Construction, Business, Engineering, Health.

**Row 3 — split**:
- Left: **Live Activity Feed** with color-coded action badges — map `action_type` to variants: CREATE→green, UPDATE→blue, DELETE→red, APPROVE→teal, OVERRIDE→amber, default→slate. Timeline-style list with left dot rail.
- Right: **Recent Override Logs** as a `Table` (Time · Schedule · From→To · Reason · By).

## 4. Design tokens (`src/styles.css`)

Add/adjust (oklch) without breaking existing tokens:
- `--sidebar`: deepen toward slate-blue (~`oklch(0.27 0.04 255)`).
- `--accent-teal`: introduce token for the quick-action button and APPROVE badge.
- `--surface-muted`: `oklch(0.98 0.005 250)` for page background.
- Sparkline stroke colors reuse existing `--stat-*` tokens.

## Technical notes

- Files touched:
  - `src/components/strategic/strategic-shell.tsx` (sidebar accordion + top bar)
  - `src/routes/_authenticated/strategic/index.tsx` (dashboard layout)
  - `src/styles.css` (token tweaks)
  - Possibly small new components: `src/components/strategic/metric-card.tsx`, `nav-group.tsx`.
- Uses existing shadcn `Accordion`, `Table`, `Tabs`, `Input`, `DropdownMenu`, `Badge`, recharts.
- Zero changes to server functions, routes, RLS, or data shape.
- Sparklines/trend deltas are presentational placeholders; flagged with a TODO so we can wire real historical series later.

## Open questions

1. Should the quick-action **+** menu actually open a working menu now (links to existing create dialogs across Departments / Modules / Venues / Semesters), or render as a styled-only stub?
2. For the **search bar** — wire it to a real cross-entity search (departments, trainers, students, modules) via a new server function, or leave as a non-functional visual element this round?
3. Sparkline trend data — keep client-side synthetic placeholders, or do you want real 7-day history (requires new server function + light schema queries)?
