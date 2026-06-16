## Redesign Login Page to match TVET ERP mockup

**File:** `src/routes/login.tsx` (single file edit). Signup mode removed from UI (admin-provisioned accounts per "Contact your administrator").

### Layout
Full-viewport split with the uploaded campus photo as background:
- Upload `login.png` as a Lovable Asset (`src/assets/login-bg.png.asset.json`) and apply as `background-image` on the page root with `bg-cover bg-center`.
- Left panel (~55% width on `lg+`): white "Welcome to **TVET ERP**" headline, subtitle "Empowering TVET Institutions with Smart ERP Solutions.", and a row of 3 small white feature pills with lucide icons:
  - Database → "Centralize Institution Data"
  - Settings → "Optimize Resources"
  - BarChart3 → "Enhance Training Outcomes"
- Right panel (~440px card on `lg+`, full width on mobile): frosted glass card (`bg-white/85 backdrop-blur-md rounded-2xl shadow-2xl`) containing:
  - Graduation cap icon + "TVET ERP" wordmark
  - "Sign in to your account" subtitle
  - **Username / Email** input with user icon prefix
  - **Password** input with lock icon prefix + eye toggle (show/hide)
  - Row: "Remember me" checkbox (left) + "Forgot Password?" link (right, primary color)
  - Solid blue "Sign In" button (full width)
  - Footer text: "Don't have an account? **Contact your administrator.**" (link styled)

### Behavior (preserved from current)
- `signInWithPassword` → `redirectByRole` (unchanged).
- "Forgot Password?" link → `/forgot-password` route (link only; no new page in this change — uses existing handler if present, else navigates to `mailto:` admin fallback). Confirm scope: link target only.
- "Remember me" is visual only (Supabase session persists by default).
- Show/hide password toggles input `type` between `password`/`text`.
- Signup flow removed from this screen.

### Styling
- Tailwind only, semantic tokens where available; brand blue `#2563eb`-ish via `bg-primary`.
- Mobile: stack — background image dimmed with overlay, card centered, left marketing block hidden below `lg`.
- Accessible labels, `aria-label` on eye toggle, `autoComplete` on inputs.

### Out of scope
No backend changes, no new routes, no auth logic changes.
