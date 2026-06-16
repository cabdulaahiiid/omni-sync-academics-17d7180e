# Plan

## 1. College logo in headers

- Upload `user-uploads://logo.jpg` via `lovable-assets` to `src/assets/college-logo.jpg.asset.json`.
- Export `COLLEGE_LOGO_URL` from `src/components/erp/brand.ts`.
- Render the logo (h-8/h-9, rounded) immediately before "Jigjiga Polytechnic College" in the three shell headers:
  - `src/components/strategic/strategic-shell.tsx`
  - `src/routes/_authenticated/operational.tsx`
  - `src/routes/_authenticated/ground.tsx`
- Also display it on the login page and the print header (`print.$report.tsx`).

## 2. Storage bucket for avatars

- Create private bucket `avatars` via the storage tool.
- Migration: add RLS policies on `storage.objects` so:
  - Any authenticated user can read avatars (bucket = 'avatars').
  - A user can insert/update/delete their own avatar (path prefix = `auth.uid()/...`).
  - Master Admins can insert/update/delete any avatar.
- Migration: add `avatar_path text` column to `public.profiles`.

## 3. Server functions (in `src/lib/profile.functions.ts`, new)

- `getMyProfile` — returns current profile incl. `avatar_path` + signed URL.
- `updateMyAvatar({ avatar_path })` — updates own profile row (RLS enforces self).
- `adminSetUserAvatar({ user_id, avatar_path })` — MA-only.
- `adminChangeUserPassword({ user_id, new_password })` — MA-only; uses `supabaseAdmin.auth.admin.updateUserById`.
- `changeMyPassword({ current_password, new_password })` — re-auth via signInWithPassword on admin client, then update.

Extend existing functions to require/accept avatar:
- `createDepartmentHead`, `createTrainer`, `createUserAccount` — add required `avatar_path: string` to validator and write it to `profiles.avatar_path` after insert.

Client-side upload helper uploads file to `avatars/{user_id_or_temp}/{uuid}.{ext}` using the browser supabase client (for self-update) or via a presign/admin path for new-user creation (use temp path `pending/{uuid}.{ext}`, then admin moves to `{new_user_id}/avatar.{ext}`).

## 4. UI changes

- New `<AvatarUploader />` component (drag/drop + preview, max 2MB, jpg/png/webp).
- **Create Department Head dialog** (`strategic/department-heads.tsx`): add required photo uploader; disable submit until photo selected.
- **Create Trainer dialog** (`strategic/trainers.tsx`): same.
- **Create user dialog** (`strategic/users.tsx`): same.
- **User details / row actions** in `strategic/users.tsx`: add a "Manage" button opening a dialog with:
  - Change/upload profile photo
  - Change password (with confirm field)
  - Existing bypass toggle moves inside this dialog (keep table switch too).
- **Profile page** (new route `/_authenticated/profile.tsx` + link in user menu): self-service avatar upload + password change.
- Render the avatar (when available) in the users table, DH table, trainers table, and top-right user menu.

## 5. Out of scope

- No changes to auth flow, roles, or other tables.
- No bulk avatar import.

## Technical notes

- Avatar paths stored as `{user_id}/avatar.{ext}`; signed URLs generated server-side (1h TTL) for display.
- Validation: file size ≤ 2 MB, mime in (`image/jpeg`,`image/png`,`image/webp`).
- Password policy: min 8 chars (matches existing `createUserAccount`).
- Audit logs entries added for `UPDATE_AVATAR` and `ADMIN_PASSWORD_RESET`.
