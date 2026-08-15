# Admin Contact Book + SMS

Admin-only (MA) module at `/strategic/contacts`, sourcing contacts from existing registrations. No changes to trainer, DH, or student workflows.

## Contact sources (live, no duplicate records)
- Department Heads / Admin staff — user profiles (new phone field, admin-editable)
- Trainers — trainer registry (name, phone, department)
- Students — student roster (name, level, section, department; phone only if present)
- Parents/Guardians — guardian name, telephone, relationship + linked student
- All Staff — heads + trainers + admins combined
- Other/Imported Staff — new manually managed table

Contacts are derived at read time, so a phone changed in a profile or trainer record shows updated instantly.

## Database changes
- `profiles.phone` (text, nullable) — staff phone, editable by Admin in Users & Roles.
- `external_contacts` — full_name, phone, role_title, department_id, notes, active. Admin-only policies + grants; unique active phone to block duplicates.
- `sms_campaigns` — sender, message body, selected groups/filters, recipient count, sent/failed counts, status, timestamps.
- `sms_recipients` — campaign_id, contact label/name, phone, source group, status, provider message id, error.
All new tables: grants, RLS, Admin-only (`has_role(auth.uid(),'MA')`) read/write; service role for send jobs.

## Contact Book UI
- List view with group tabs, search by name/phone, filters for group, department, class/section, and status.
- Row click opens an individual contact panel (identity, phone, group, department, linked student for guardians).
- Other Staff tab: add/edit/deactivate/delete, plus Excel/CSV import reusing the existing dropzone + template helpers, with phone validation and duplicate detection.
- Ethiopian phone rules reuse `src/lib/phone.ts` (`+251…` normalization) everywhere.

## SMS Composer
- "Create SMS" opens a recipient builder: all contacts, one group, multiple groups, individuals, or a mix — with the same department/class filters.
- Recipients are de-duplicated by normalized phone; live unique-recipient count.
- Message box with `{Name}` personalization token, character/segment counter, preview of the first rendered message, and a confirmation step before sending.
- Send runs server-side in batches through Twilio, writing per-recipient status; the UI shows progress and a final sent/failed summary.

## SMS History
Table of past campaigns: date/time, sender, message excerpt, groups targeted, total/sent/failed, status; expandable per-recipient detail with failure reasons.

## Security
- Every contact and SMS server function starts with `requireRole(context, ["MA"])`; no phone data is returned to non-admins even via direct API calls.
- RLS on new tables restricts all access to Admins.
- Send actions and imports are written to the existing audit log.

## Technical notes
- New files: `src/lib/contacts.functions.ts`, `src/lib/sms.functions.ts`, `src/lib/sms/provider.server.ts` (provider-independent interface with a Twilio implementation via the Lovable connector gateway), `src/routes/_authenticated/strategic/contacts.tsx` (+ small components for the composer/history).
- Twilio is called only from server functions using the connector gateway; the sender number is configurable.
- Reuses existing shells, tables, dialogs, CSV dropzone, export helpers, and RBAC — no changes to unrelated modules.

## Needed from you
A Twilio connection (account + a Twilio number to send from). I will open the connect card during implementation; everything else works without it, with sends blocked until it's linked.
