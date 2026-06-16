## Plan: Simplify Login Page to Match Reference Image

Rewrite `src/routes/login.tsx` to remove all the duplicate/extra UI built in earlier turns and match the uploaded reference exactly.

### Replace background asset
- Upload the new `Gemini_Generated_Image_2xvojn2xvojn2xvo.png` via `lovable-assets` as `src/assets/login-bg.png.asset.json` (overwrites the existing pointer). The image already contains the "Welcome to TVET ERP" text, subtitle, and 3 feature icon pills baked in — we do not re-render them in HTML.
- Delete nothing else; the old asset pointer is simply replaced.

### Rewrite `src/routes/login.tsx`
Strip the page down to:
- Full-viewport `div` with `background-image: url(loginBg.url)`, `bg-cover bg-center`.
- **No left panel.** No "Welcome" text, no feature cards, no headings, no footer text, no logo, no "Sign in to your account" subtitle, no "Remember me", no "Forgot Password?", no "Don't have an account" line, no GraduationCap icon — all removed.
- **Single minimalist login box on the right**, vertically centered, positioned over the plaza area:
  - Container: `bg-white/90 backdrop-blur-md rounded-xl shadow-2xl p-6 w-full max-w-sm`
  - Positioned via `flex justify-end items-center` on the outer wrapper with right-side padding (`pr-8 lg:pr-24`)
  - Contents (in order):
    1. Email/username `<Input>` (with `User` icon prefix)
    2. Password `<Input>` (with `Lock` icon prefix + `Eye`/`EyeOff` toggle)
    3. "Sign In" `<Button>` (full width, primary)
- Auth logic preserved: same `signInWithPassword` + `redirectByRole` flow, same loading/error toasts.
- Drop unused imports (`Checkbox`, `Label`, `Database`, `Settings`, `BarChart3`, `CalendarCheck`, `GraduationCap`).

### Out of scope
No route, auth, or backend changes. No new components. Single-file edit + one asset replacement.
