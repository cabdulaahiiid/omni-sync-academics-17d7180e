
# Final Integration — Phases 6–10

The state machine, server functions, approval queue, and live monitor are already shipped (see `.lovable/plan.md`). What remains is wiring the pieces into a fully usable, navigable system across all three roles.

## Phase 6 — Trainer mobile session flow
- `src/routes/_authenticated/ground/$scheduleId.tsx` — full session detail page
  - Mode selector (Theory / Practical / Both) → `setSessionMode`
  - 30-min/200m **Check-In** button: client gatekeeper mirrors server (poll geolocation every 10s, show distance, enable when in window)
  - 50-min countdown after check-in (manual submit, no auto)
  - Roster (offline-queued via existing Dexie outbox)
  - LO + Lesson Plan form (both required, ≥5 chars)
  - End Session → progress counter `X / 15`
- `src/hooks/use-geo-gatekeeper.ts` — geolocation + time-window watcher
- `src/components/countdown-timer.tsx`
- Update `src/routes/_authenticated/ground/index.tsx` today list to link into the new detail route

## Phase 7 — DH weekly matrix + swap drawer
- `src/routes/_authenticated/operational/matrix.tsx` — trainers × dates grid for selected week, conflict highlight (overlapping trainer/venue badges), click cell → swap drawer
- `src/routes/_authenticated/operational/semester-upload.tsx` — xlsx upload calling the existing slicing engine, conflict report
- `src/routes/_authenticated/operational/attendance.tsx` — list + 24h override modal w/ mandatory audit comment
- `src/components/weekly-matrix.tsx`, `src/components/swap-trainer-drawer.tsx`

## Phase 8 — MA insights + bulk imports
- `src/routes/_authenticated/strategic/insights.tsx` — live sessions, workload heatmap, pending growth (uses `dashboardInsights`)
- Modules bulk-import modal on existing `strategic/modules.tsx`
- Semester upload modal on existing strategic dashboard

## Phase 9 — Reports & seed
- Extend `src/lib/exports.functions.ts` with attendance %, LO dump, trainer velocity, conflict log (CSV)
- Extend `src/lib/seed.functions.ts` to emit a full 16-week semester so the MA→DH→Trainer loop is testable end-to-end with the existing demo accounts

## Phase 10 — Navigation & integration
- Add the new routes to both shells' sidebars (`operational.tsx`, `strategic.tsx`)
- Replace placeholder anchor tags with `<Link>` once routes exist
- Wire `notifications-bell` and `offline-banner` into all three role shells (currently only root)
- Smoke-test path: log in as MA → seed → approve semester → log in as DH1 → view matrix + live monitor → log in as trainer1 → run session end-to-end

## Defaults (from open questions in plan.md)
1. Gatekeeper uses `max(venue.geo_radius, 200)` (already implemented server-side).
2. 50-min timer = manual submit, no auto.
3. Trainer target = `trainer_registry.sessions_target` column (already exists, default 15).

## Out of scope (this pass)
- Push notifications (in-app bell only)
- XLSX export (CSV only for now)

Reply **approve** to ship all of the above in one batch.
