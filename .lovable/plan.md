## Goal

Three fixes to the Semester Schedule Builder, in one deployment, without breaking anything else:

1. Section 3 (Trainer Assignment) shows no trainers — fix the data path so only **trainers with login credentials** appear.
2. After creating a draft, the page must offer a clean **Save as Draft** path and a separate **Submit for Approval** path that follows the existing approval rules.
3. Make the builder page **~60–70% shorter** so users don't have to scroll the whole page to reach validation / actions.

---

## 1. Root cause for "no trainers" (verified against the DB)

- `auth.users` has 6 users (1 MA, 1 DH, 3 with role `T`, 1 unassigned), but `public.profiles` is **empty**.
- The `handle_new_user` and `bootstrap_first_user_as_ma` functions exist, but **no triggers are attached to `auth.users`**, so signups never create profile rows.
- `trainer_registry` is also empty, so the builder's trainer combobox is empty even though trainers can sign in.

### Fix (single migration)

- Attach the missing triggers on `auth.users`:
  - `on_auth_user_created` → `handle_new_user()` (creates a `profiles` row).
  - `on_auth_user_created_bootstrap` → `bootstrap_first_user_as_ma()`.
- Backfill `profiles` for every existing `auth.users` row that is missing one.
- For every profile whose user has role `T` and no `trainer_registry_id`, create a `trainer_registry` row (deriving `hidden_staff_id` from the email local part, falling back to a short UUID) and link `profiles.trainer_registry_id` to it.
- New SQL helper `link_trainer_login(_profile_id uuid)` (SECURITY DEFINER, MA-only) so the Strategic → Users page can repair links later without another migration.

### Builder query change

`getBuilderOptions` (in `src/lib/semester-builder.functions.ts`) currently selects every `trainer_registry` row in the department. Replace with: `trainer_registry` rows that have a **matching profile** with role `T` (i.e. a usable login). Implementation: join through `profiles` + `user_roles` on the server, return only those rows. DH stays scoped to their department; MA can target any department.

Result: Section 3 lists exactly the trainers who can log in to the Trainer (Ground) workspace.

---

## 2. "Save as Draft" vs "Submit for Approval" — apply system rules

Today the bottom bar's primary button (`Submit & Publish`) silently calls `saveBuilderDraft` and then opens the publish dialog. That mixes two intents. Replace with three explicit actions that mirror the rules already enforced server-side:

- **Validate Schedule** (unchanged): runs `validateBuilder`. Save/Submit stay disabled while red conflicts exist.
- **Save as Draft**: calls `saveBuilderDraft` only. Rows are inserted as `status='DRAFT'`; semester `distribution_status='DRAFT'`. Toast confirms count; **no dialog auto-opens**. User stays on the page and can keep adding more module/trainer combinations to the same semester.
- **Submit for Approval**: enabled only after at least one successful save for the current semester (and no unresolved validation conflicts). Opens the existing dialog with the two existing server-rule paths:
  - *Request Approval by Week* → `dhRequestApprovalPerWeek` (`ma_split_semester_to_weeks` review flow).
  - *Request Approval for Full Semester* → `requestSemesterApproval` (semester-level `approval_queue` row, notifies all MAs).
- The bar shows a small "X draft session(s) saved for this semester" hint so users know what they're submitting.
- Role gate: button only renders for DH or MA (existing `requireRole` server-side check stays as the source of truth; UI gate is cosmetic).

No new server functions; reuse existing ones so audit_logs, notifications, and approval_queue behave exactly as today.

---

## 3. Compact the page (~60–70% less scroll)

Keep all 7 sections and the live preview, but stop forcing the user to scroll the whole page:

- Replace the stacked `SectionCard`s on the left with a **single Accordion** (`@/components/ui/accordion`, type `multiple`). Sections 1–3 open by default; 4–7 collapsed. Each section auto-collapses once its required fields are filled and auto-opens the next.
- Shrink the hero card from `p-5` + 40px icon to a single-line header (title + one-line helper, no gradient block).
- Drop the `pb-28` bottom padding to `pb-20` and move the sticky action bar inside the right column on `lg+` so it isn't a full-width fixed strip.
- Use `space-y-2` instead of `space-y-4` between section cards and tighten internal `gap-3` grids to `gap-2`.
- Right column (Live Preview + Validation) stays sticky and combines into one card with two tabs (`Preview` / `Validation`) so the viewport shows one panel at a time instead of two stacked cards.

Net effect: the builder fits in a typical 900–1000px viewport without scrolling past Section 4, matching the requested 60–70% reduction.

---

## Files touched

- **New migration** — attach `auth.users` triggers, backfill `profiles`, backfill `trainer_registry` + link, add `link_trainer_login` helper.
- `src/lib/semester-builder.functions.ts` — change `getBuilderOptions` trainer query to require an active login (role `T`).
- `src/routes/_authenticated/operational/semester-upload.tsx` — accordion layout, condensed hero, split Save / Submit actions, "drafts saved" counter, single tabbed right panel.

## Out of scope

- No changes to approval, notification, or audit behavior — only the call sites for Save vs Submit are split.
- No changes to other ERP modules, auth, or role checks.
- No edits to `src/integrations/supabase/*` auto-generated files.
