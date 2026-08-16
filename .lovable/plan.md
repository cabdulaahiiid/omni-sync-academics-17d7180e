# System-wide form correctness, UX and save-behavior overhaul

The screenshot did not come through on my side, so this plan targets every registration/data-entry form in the system rather than one screen. The Trainer, Users & Roles, Department Head, Student, Venue, Department, Section, Level, Module and Contact forms all get the same treatment.

## 1. Email vs Telephone — strict separation

Today each form keeps email and phone in separate state, but the inputs are visually identical and nothing stops a user from typing an email into the telephone box until after submit. Fixes:

- A shared `EmailField` and `PhoneField` pair of components: correct `type`, `inputMode`, `autoComplete`, placeholder, and per-field inline error text.
- Telephone rejects anything containing `@` or letters immediately, with the Ethiopian-format message; email requires a valid address. Neither field can accept the other's format.
- Live validation on blur plus a submit-time gate, mirroring the existing server-side Zod rules so client and server agree.
- Confirm each form writes email to the email column and phone to the phone column (staff → `profiles.phone` / `trainer_registry.phone`, students → `students.telephone`, guardians → `students.parent_guardian_telephone`). No schema changes.

## 2. Form UX

- Introduce a small form layout kit (`FormSection`, `FormGrid`, `FormRow`) used by every dialog: labelled sections, two-column grid on desktop collapsing to one column on mobile, consistent spacing, required markers, help text and error slots.
- Long dialogs (Create trainer, Register account, Student registration) get a scrollable body with a sticky header and sticky footer so Save is always reachable on tablet/mobile.
- Keep current colours, typography and overall structure; this is layout and clarity only.

## 3. Save behavior — the Word-like contract

A single reusable `useFormSubmit` hook wraps every create/edit mutation so all forms behave identically:

1. Block submit unless every required field validates; scroll to and focus the first invalid field.
2. Disable the Save button and show a spinner while in-flight; ignore repeat clicks (guards double submission).
3. Only after the server function resolves successfully: show the success toast, close the dialog, reset the form.
4. Await the list query invalidation so the table shows the new row the moment the dialog closes.
5. On failure: dialog stays open, all typed values preserved, the real server error shown inline at the top of the form and as a toast.

Also prevents closing the dialog (Esc / overlay click) while a save is in flight.

## 4. Performance

- Give master-data and list queries sensible `staleTime` so opening a dialog does not refetch departments/levels/sections every time.
- Replace broad invalidation with targeted keys; batch related invalidations into one pass.
- Memoize dependent dropdown option lists so typing in one field does not re-render the whole dialog.
- Immediate visual feedback on every action button.

## 5. Verification

For each form — Trainer, User account, Department Head, Student (+ guardian), Department, Level, Section, Venue, Module, Contact — verify Create → Save → Close → Refresh → Row visible, plus a deliberate failure case (duplicate phone) confirming the dialog stays open with data intact.

## Technical notes

- New: `src/components/forms/fields.tsx` (EmailField, PhoneField, TextField, SelectField), `src/components/forms/layout.tsx`, `src/hooks/use-form-submit.ts`.
- Edited: the route files listed above; server functions untouched except where a validation message needs to match the client.
- No database migrations, no business-rule changes.
