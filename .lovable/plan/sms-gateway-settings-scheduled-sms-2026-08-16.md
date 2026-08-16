# SMS Gateway Settings + Scheduled SMS

Two additions to the existing Admin Contact Book & SMS module. Nothing else changes.

## 1. SMS Gateway Settings (Admin only)

A new "Gateway Settings" tab on the Contact Book & SMS page where an Admin can edit, without redeploying:

- API key (write-only field: shows a masked preview like `••••3f2a`, replaced only when a new value is typed)
- Sender ID
- Environment: Development or Production
- Base URL per environment (Production endpoint and Development/sandbox endpoint), pre-filled with the smsethiopia.com defaults
- A "Send test SMS" button to one number, showing the gateway's own response

Behaviour:
- Settings are stored in the database, so changes take effect on the next send — no redeploy.
- The sending layer reads database settings first and only falls back to the existing project secrets when no row is configured. Current setup keeps working untouched.
- In Development environment, the page shows a clear "Dev mode" badge and every campaign is tagged so history makes the source obvious.
- The API key is never returned to the browser — only the masked hint, the sender ID, environment and URLs are.

## 2. Scheduled SMS

The composer gets a "Send now / Schedule for later" choice. Choosing Schedule adds a date + time picker (local time, stored as an absolute timestamp).

- A scheduled campaign is saved with its full recipient list and status `SCHEDULED`, plus the scheduled time.
- History shows scheduled batches alongside sent ones with status `SCHEDULED`, `SENDING`, `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`, the scheduled time and a countdown.
- Admins can cancel or reschedule a batch while it is still pending, and open it to see the per-recipient result once it has run.
- A background job runs every minute, picks up any batch whose time has arrived, sends it and writes per-recipient statuses exactly like an immediate send. Batches are claimed atomically so a batch can never be sent twice.

## Technical notes

- Migration adds: `public.sms_settings` (single row: api_key, sender_id, environment, prod_base_url, dev_base_url, updated_by/at) with Admin-only RLS and GRANTs; new columns on `sms_campaigns` (`scheduled_at`, `environment`, `claimed_at`) and a `sms_campaign_recipients_planned` table holding queued recipients for scheduled batches. New campaign statuses are text values, so no enum change.
- Enables `pg_cron` + `pg_net` and schedules a minute cron that calls a new endpoint `src/routes/api/public/sms-dispatch.ts`, protected by a shared secret header (generated, stored as a project secret).
- `src/lib/sms/provider.server.ts` gains a settings loader: DB row → env-var fallback; base URL chosen by environment.
- `src/lib/sms.functions.ts` gains `getSmsSettings`, `updateSmsSettings`, `sendTestSms`, `scheduleSmsCampaign`, `cancelScheduledCampaign`, `rescheduleCampaign`, and a shared `dispatchCampaign` helper used by both immediate and scheduled sends. All Admin-gated with `requireRole(ctx, ["MA"])`.
- UI: new tab + components inside `src/routes/_authenticated/strategic/contacts.tsx`; composer and history extended in place.
