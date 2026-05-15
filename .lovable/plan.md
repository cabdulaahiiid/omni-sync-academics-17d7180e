
# Full Production Rollout Plan

This is a large, multi-system build. I will execute it phase-by-phase, fully (no stubs). Below is the complete plan so you can confirm scope before I burn through implementation. **Reply "go" and I start Phase 1 immediately and run straight through Phase 5.**

---

## Phase 1 — Database hardening + Offline Sync Queue

**DB migration (one shot):**
- Add `pending_sync` table (server-side reconciliation log): `id, trainer_registry_id, schedule_id, client_uuid (unique), payload jsonb, kind ('attendance'|'session_log'), client_timestamp, server_received_at, status ('applied'|'conflict'|'rejected'), conflict_reason`.
- Add unique index on `attendance_logs(schedule_id, student_id)` to make idempotent upserts safe.
- Add unique index on `session_logs(schedule_id)`.
- `submit_session_batch(payload jsonb)` SECURITY DEFINER RPC — atomic upsert of session_log + attendance rows, returns per-row status (applied/conflict). Server timestamp wins on conflict; client gets `conflict_reason`.

**Client offline layer (`src/lib/offline/`):**
- `db.ts` — Dexie (IndexedDB) with stores: `outbox` (pending mutations), `cache_schedules`, `cache_students`, `meta`.
- `queue.ts` — `enqueue(mutation)`, `flush()`, exponential backoff, dedupe by `client_uuid`.
- `sync-engine.ts` — listens to `online`/`offline` + `visibilitychange`, calls `submitSessionBatch` server fn, applies returned conflict resolutions, emits events for UI banner.
- `use-offline-sync.ts` hook — exposes `{ online, pendingCount, lastSyncAt, conflicts }`.
- Global `<OfflineBanner />` mounted in `__root.tsx`.

**Conflict resolution rules (explicit, coded):**
1. Same `(schedule_id, student_id)` already has a server log newer than client timestamp → server wins, client entry marked `conflict`, surfaced to trainer.
2. Geo-fence violation at server time → reject with `conflict_reason='geo_fence'`.
3. Outside attendance window → reject with `conflict_reason='window_expired'`.
4. Duplicate submission (same `client_uuid`) → idempotent no-op (`status='applied'`).

---

## Phase 2 — Mobile Trainer Check-In Flow

New route tree under `/_authenticated/trainer/` (mobile-first, single column, large tap targets, bottom nav):
- `trainer/index.tsx` — today's schedule cards + completion velocity tracker.
- `trainer/session.$scheduleId.tsx` — full check-in flow:
  1. Geo capture (`navigator.geolocation`) → compare to `venues.latitude/longitude/geo_radius`.
  2. Attendance roster (students from section) with present/absent toggles.
  3. Lesson Plan + Learning Outcome textareas.
  4. Submit → enqueues to outbox → flushes immediately if online, otherwise queued.
  5. Confirmation screen + updated "Completed Sessions: X of Y".
- All writes go through the offline queue (works offline, syncs on reconnect).
- Responsive breakpoint via existing `useIsMobile`; route uses Tailwind mobile-first classes only.

---

## Phase 3 — Notifications + DH Approval Queue

**Notification engine:**
- DB trigger on `approval_queue` insert → inserts `notifications` row for relevant DH (`department_id` match via `schedules`).
- DB trigger on `attendance_overrides` insert → notifies MA + affected trainer.
- DB trigger on `leave_requests` insert → notifies DH of department.
- Server fn `sendEmail` using Resend via existing `LOVABLE_API_KEY` pattern OR Lovable email; fallback: log + in-app. (I'll wire Resend if you add `RESEND_API_KEY`; otherwise in-app + browser Push API for installed users.)
- Web Push: register service worker (production-only guard per Lovable PWA rules), store subscription in new `push_subscriptions` table, server fn `pushNotify`.
- Realtime channel `notifications:user_id=eq.<uid>` for instant in-app toast.

**DH Approval Queue UI** (`/_authenticated/dh/approvals`):
- Live list of pending schedules with conflict badges (invalid_qualification, excessive_load, conflict_venue, conflict_trainer).
- Approve / Reject (with feedback) actions → updates `schedules.status` + removes queue row + notifies creator.
- Realtime subscription for live updates.

---

## Phase 4 — Reporting, Exports, Live Sync

**Exports** (`src/lib/reports.functions.ts`):
- `exportAttendanceCSV({ from, to, department_id? })`
- `exportSessionLogsCSV(...)`
- `exportTrainerVelocityCSV(...)`
- Server fn returns CSV string; client triggers download via Blob.
- XLSX variant via `xlsx` package for MA users.

**Live sync everywhere:**
- Enable realtime on: `schedules`, `attendance_logs`, `session_logs`, `approval_queue`, `attendance_overrides`, `notifications`.
- DH dashboard "Live Monitoring": realtime `session_logs` stream filtered by department → instant cards.
- Strategic dashboard: realtime `audit_logs` feed.

---

## Phase 5 — Seed Test Accounts

Server fn `seedDemoData` (MA-only, idempotent):
- Departments: ICT, Construction, Hospitality.
- DHs: `DH1@tvet.com`/`Head@123` (ICT), `DH2@tvet.com`, `DH3@tvet.com`.
- Trainers: `trainer1@tvet.com`/`Trainer@123` … `trainer6@tvet.com`, distributed across departments with qualifications.
- Levels (L3/L4/L5), sections, modules, venues with real lat/lon (Kigali coords for geo testing).
- Students: ~30 per section.
- Sample schedules across this week.
- Triggered from new `/strategic/settings` button "Seed Demo Data".

---

## Technical notes
- All server fns use existing `requireSupabaseAuth` + role gating.
- Migrations bundled into 2 files (Phase 1 schema, Phase 3 triggers).
- New deps: `dexie`, `xlsx`. (No `vite-plugin-pwa` — Web Push uses a hand-written SW guarded against iframe per Lovable rules.)
- Email provider: I'll proceed with **in-app + Web Push only** unless you confirm you want Resend (needs `RESEND_API_KEY` secret).

---

**Confirm to proceed:**
1. Use Web Push + in-app only, or also wire Resend email (requires you adding `RESEND_API_KEY`)?
2. Seed account passwords as specified (`Head@123` / `Trainer@123`) — OK?

Say **"go"** (with answers to 1 & 2) and I'll execute Phases 1→5 end-to-end.
