# Plan: Semester Schedule Builder (replaces Excel upload)

## Goal
Replace `/operational/semester-upload` with an intelligent, form-driven Semester Schedule Builder that writes directly to Supabase, validates conflicts in real time, and propagates changes across the ERP via Realtime — preserving every existing route, permission, and workflow.

## Scope
- New page: `src/routes/_authenticated/operational/semester-builder.tsx` (the existing route file is rewritten in place so all current links keep working).
- New server fns in `src/lib/semester-builder.functions.ts` for option loading, validation, save-as-draft, and publish — all `requireRole(["DH","MA"])`.
- Realtime: enable `supabase_realtime` on `schedules`, `semester_registry`, `approval_queue`, `notifications` (any not already enabled), and add a lightweight `useLiveTables` subscription so the page invalidates affected queries app-wide.
- Reuse existing publish/approval pipeline (`submit_for_approval`, `dh_submit_semester_per_week`, `decide_approval`) so timetables, attendance sessions, live monitor, and reports all populate automatically — no new write paths.
- Do not touch `xlsx-templates.ts`, `dh-extras.functions.ts`, drafts page, approvals, attendance, live monitor, reports, dashboards, or any UI outside this one route.

## UI (single page, two-column on desktop)

Left: stacked collapsible cards in this order.
1. **Semester Information** — Academic Year + Semester selects from `semester_registry`; auto-show weeks (computed from start/end) and start/end dates.
2. **Module Information** — Combobox over `modules` (search by code or name); auto-fill name, credit hours, department, type.
3. **Trainer Assignment** — Combobox over `trainer_registry` (dept-scoped for DH); show ID, department, current assigned weekly hours (derived from `schedules`), availability badge from validator.
4. **Schedule Information** — sessions/week, hours+minutes/session; auto-compute weekly hours and total contact hours.
5. **Class Assignment** — Section, Level, Venue comboboxes; show venue capacity, type, current availability badge.
6. **Delivery Type** — Theory / Practical / Both; per-type day multi-select + session name.
7. **Schedule Timing** — Start date + start time; auto end date/time + semester completion date from frequency × weeks × session days.

Right (sticky): **Live Preview** card with all computed values + a **Validation panel** (Green/Yellow/Red chips per check: trainer double-book, trainer overload, venue double-book, venue capacity, section overlap, module duplicate, semester contact-hour cap).

Sticky bottom action bar: **Cancel**, **Save as Draft**, **Validate Schedule**, **Submit & Publish** (opens existing "by week / full semester" dialog).

## Validation server fn
`validateBuilderDraft({ semester_id, module_id, trainer_id, section_id, level_id, venue_id, delivery, days[], start_date, start_time, duration_min, sessions_per_week, weeks })` returns `{ conflicts: [{kind, severity, reason, refs}], warnings: [...], summary: {weekly_hours,total_hours,end_date,end_time} }`. Reuses the conflict SQL pattern in `dh-extras.functions.ts` (trainer/venue/section overlap by date+time) but evaluated against the generated occurrence list before insert.

## Save / Publish
- **Save as Draft**: server fn expands occurrences into `schedules` rows with `status='DRAFT'` inside a single transaction (RPC) so partial writes can't happen. Blocks on any red conflict.
- **Submit & Publish**: same path as today — call existing `requestSemesterApproval` (full) or `dhRequestApprovalPerWeek` (weekly) so MA approval flow, notifications, audit logs, attendance/session generation, trainer/dept/student/venue timetables, live monitor, and reports all light up via the existing triggers.

## Real-time sync
- One migration: `ALTER PUBLICATION supabase_realtime ADD TABLE …` (idempotent guard) for `schedules`, `semester_registry`, `approval_queue`, `notifications` if missing; also `REPLICA IDENTITY FULL` on those tables.
- Builder page subscribes to `schedules` + `semester_registry` and calls `queryClient.invalidateQueries` on the relevant keys so trainer load / venue availability / preview update without refresh. Existing `use-live-tables` / `use-dh-live-channel` hooks already fan changes into dashboards.

## Security
- All new server fns: `requireRole(ctx, ["DH","MA"], "<fn>")`. DH writes scoped to their department server-side. MA can target any department.
- No client-side trust: validator and save fn re-resolve module/trainer/venue/section by ID and re-check dept membership.
- RLS unchanged; existing policies on `schedules`/`semester_registry` already enforce dept ownership.

## What stays untouched
- Login, auth gate, role routing, `_authenticated` layout, all other routes, drafts, approvals, attendance, live monitor, reports, exports, notifications, profile, MA admin pages, trainer ground views.
- `xlsx-templates.ts` and `DownloadTemplateButton` stay (used elsewhere); only the Excel ingest UI on this one page is removed.

## Files
**New**
- `src/lib/semester-builder.functions.ts`
- `src/components/semester-builder/section-card.tsx`
- `src/components/semester-builder/live-preview.tsx`
- `src/components/semester-builder/validation-panel.tsx`
- `src/components/semester-builder/searchable-combobox.tsx` (thin wrapper over shadcn `Command` + `Popover`)
- `supabase/migrations/<ts>_realtime_publication.sql`

**Edited**
- `src/routes/_authenticated/operational/semester-upload.tsx` → rewritten as the Builder (route path preserved so nav/links keep working; page title becomes "Semester Schedule Builder").
- `src/components/operational/*-nav.tsx` (label only, if present) — keep the route, update label to "Schedule Builder".

**Removed**
- None. The Excel handler code inside the old `semester-upload.tsx` is deleted as part of the rewrite; no other file is touched.

## Out of scope
- Redesign of dashboards, reports, drafts, approvals, attendance UIs.
- New analytics surfaces.
- Auth/role changes.
