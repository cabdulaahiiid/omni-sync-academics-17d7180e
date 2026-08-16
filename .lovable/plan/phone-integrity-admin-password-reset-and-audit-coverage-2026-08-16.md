# Phone integrity, admin password reset, and audit coverage

## 1. Strict phone validation + uniqueness

- Every staff telephone (Master Admin, Department Head, Trainer) and every student telephone must be a valid Ethiopian number and unique across the whole system.
- Parent/guardian numbers stay valid-format and may be shared between siblings, but cannot collide with a staff or student number.
- Duplicate attempts show a plain-language message naming who already owns it, e.g. "This telephone number is already used by Department Head Abebe Kebede." — never a raw database error.

Database work (one migration):
- Unique index on `profiles.phone` (where phone is not null) — covers DH/MA/Trainer logins.
- Keep existing unique indexes on `trainer_registry.phone` and `students.telephone`.
- A shared lookup function that, given a normalized phone, reports which record already uses it (staff profile / trainer / student) so the app can build the friendly message.

Application work:
- Central helper `assertPhoneAvailable(phone, ignore)` used by: create DH, create Trainer, create user (Users & Roles), admin phone edit, student create/edit.
- All writes normalize to `+251XXXXXXXXX` before checking and saving.
- Client forms keep inline format validation and now also surface the server duplicate message on the field.

## 2. Admin password reset forces re-authentication

- After a Master Admin sets a new password, every existing session of that user is revoked, so the user is signed out everywhere and must sign in again with the new password.
- The admin dialog confirms: "Password updated. The user has been signed out of all devices."

## 3. Audit logging for admin changes

Every admin action on another user writes an `audit_logs` row with actor, target, before/after:
- Telephone change (`UPDATE_PHONE`) — already present, keeps before/after.
- Password reset (`ADMIN_PASSWORD_RESET`) — add note that sessions were revoked (never store the password).
- Suspend / Activate (`SUSPEND_USER` / `ACTIVATE_USER`) — already present, add before state.
These appear in the existing Audit Logs page with no changes needed there.

## 4. Contact Book stays in sync

The Contact Book is assembled live from profiles and trainer registry, so a DH phone edit is reflected as soon as the data refreshes. Change: after an admin saves a telephone (or a DH is created), the contacts and department-heads caches are invalidated so the new number appears immediately without a manual reload.

## 5. Form field sets

- Student registration: student telephone + parent/guardian name, telephone, relationship (unchanged).
- All staff forms (Department Head, Trainer, Users & Roles create): full name, email, telephone, department, role, profile image, password — no parent fields. Audit these three forms and remove or add fields so they match exactly.

## Technical notes

- Files: `src/lib/phone.ts` (add duplicate-message helper), new `src/lib/phone-uniqueness.server.ts`, `src/lib/dh.functions.ts`, `src/lib/users-admin.functions.ts`, `src/lib/students.functions.ts`, `src/lib/profile.functions.ts`, plus the three form routes and `src/routes/_authenticated/strategic/contacts.tsx` cache keys.
- Session revocation uses the admin sign-out (global scope) for the target user immediately after the password update.
- Migration adds only indexes and a read-only lookup function; no table or column changes.
