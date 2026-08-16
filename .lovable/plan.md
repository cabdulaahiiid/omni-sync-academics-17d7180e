# Admin Contact Book + SMS (SMS Ethiopia gateway)

Same feature as approved, with SMS Ethiopia (smsethiopia.com) replacing Twilio as the sending gateway. The database work is already applied; everything below is the remaining build.

## Sending layer
- A single provider-independent service (`sendSms(to, text)`) with one implementation: SMS Ethiopia REST API.
- Credentials stored as project secrets (`SMSETHIOPIA_API_KEY`, plus sender ID / base URL if their account uses one). I will request the API key through the secure secret prompt — never in code.
- Called only from server functions; the key is never exposed to the browser.
- Provider responses (status + body) are recorded per recipient, so failures show the gateway's own reason.
- Swapping or adding another gateway later means one new file implementing the same interface.

## Contact Book (Admin only, `/strategic/contacts`)
Groups derived live from existing records — no duplicate contact rows:
- Department Heads / Admin staff — user profiles (`phone` field, admin-editable)
- Trainers — trainer registry
- Students — student roster
- Parents/Guardians — guardian name, telephone, relationship, linked student
- All Staff — heads + trainers + admins
- Other/Imported Staff — the new `external_contacts` table

Features: group tabs, search by name/phone, filters for group, department, class/section and status, row-click detail panel, and for Other Staff: manual add, Excel/CSV import (existing dropzone), edit, deactivate, delete — with Ethiopian phone validation (`+251…`) and duplicate blocking.

## SMS Composer
- Recipient builder: all contacts, one group, several groups, individuals, or any mix, with the same department/class filters.
- De-duplication by normalized phone with a live unique-recipient count.
- Message box with `{Name}` personalization, character/segment counter, rendered preview, and a confirm step.
- Server-side batched send with per-recipient status and a final sent/failed summary.

## SMS History
Campaign list: date/time, sender, message, groups targeted, total/sent/failed, status; expandable per-recipient results with error text.

## Security
- Every contact and SMS server function begins with `requireRole(context, ["MA"])`.
- New tables are RLS-restricted to Admins; phone data is never returned to other roles, even via direct API calls.
- Imports and sends are written to the audit log.

## Technical notes
- New files: `src/lib/contacts.functions.ts`, `src/lib/sms.functions.ts`, `src/lib/sms/provider.server.ts` (SMS Ethiopia client), `src/routes/_authenticated/strategic/contacts.tsx` plus small composer/history components.
- Reuses existing shells, tables, dialogs, CSV dropzone, export helpers and RBAC; no other module is touched.

## Needed from you
Your SMS Ethiopia API key (and sender ID, if your account has one) — I'll open the secure prompt. If their API differs from the standard `POST` with API key + `to` + `msg` fields, paste the endpoint from their docs and I'll match it exactly.
