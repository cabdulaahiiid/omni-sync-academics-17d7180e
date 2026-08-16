# Manage User dialog — separate Email & Telephone, fix dialog sizing

## What's wrong today
The "Manage user" dialog on Users & Roles has a Telephone field but **no email field at all** (email is only shown read-only in the table). The dialog also has no scroll area or width override, so on typical screens the Roles/Departments section and the Close button get pushed off-screen — you can't see the whole box.

## What changes

### 1. Separate, correctly typed contact fields
Add a **Contact details** section at the top of the Manage user dialog with two clearly separated cells:
- **Email address** — email keyboard/validation, rejects phone-shaped input, shown with its own Save button.
- **Telephone number** — Ethiopian phone validation, digits/+/-/() only (letters and `@` can never be typed), own Save button.

Both use the shared `EmailField` / `PhoneField` components already used by the create-user and trainer/DH forms, so the two fields can never hold each other's data.

Saving the email updates the login email and the profile record together, with the same duplicate-detection and audit-log treatment the telephone update already has.

### 2. Dialog UI/UX so it is fully visible
- Wider dialog (`sm:max-w-2xl`) with a scrollable body capped at ~70vh, so header and the footer Close button stay fixed and every section is reachable.
- Regroup the contents into labelled sections with the standard form layout: Profile photo, Contact details (2-column), Security (password), Account status, Roles & departments.
- Consistent field spacing, inline validation messages, and disabled/saving states on each section's Save button.

## Technical notes
- New server function `adminSetUserEmail` in `src/lib/users-admin.functions.ts`: MA-only via `requireRole`, zod-validated email, `supabaseAdmin.auth.admin.updateUserById` + `profiles.email` update (+ `trainer_registry.email` when linked), duplicate-email guard with a friendly message, and an `UPDATE_EMAIL` audit-log entry.
- Dialog rework in `src/routes/_authenticated/strategic/users.tsx` using `FormSection`/`FormGrid`/`FormBody` from `src/components/forms/layout.tsx` and `EmailField`/`PhoneField`/`PasswordField` from `src/components/forms/fields.tsx`.
- List invalidation on success so the table reflects the new email/phone immediately.
