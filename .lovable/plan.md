## Login page cleanup — solid two-column layout

**File:** `src/routes/login.tsx` (single file edit)

### Problems being fixed
- Left side currently renders directly over the background image with a dark gradient overlay, producing the "ghost text / blurry layer" effect.
- Left marketing block has no container — text and pills float over the photo causing low legibility.
- Only 3 feature pills exist; spec requires 4.

### Layout (final)
Two solid columns side-by-side, background photo only visible in the center gap and far edges.

```text
[ photo ][ SOLID WHITE LEFT COLUMN ][ photo gap ][ FROSTED RIGHT CARD ][ photo ]
```

- Remove the full-bleed `bg-gradient-to-r from-black/50 ...` overlay div entirely (source of the "ghost" darker layer).
- Page root keeps `backgroundImage: url(loginBg)` with `bg-cover bg-center` so the photo shows through the central gap.
- Container becomes a centered flex row with `gap-8` and `max-w-6xl`, vertically centered.

### Left column (new solid white card)
- Wrap the entire left content in: `bg-white rounded-2xl shadow-2xl p-10 lg:p-12 w-full lg:max-w-xl`
- Content inside (single clean layer, dark text on white):
  1. **Primary header:** "Welcome to" (light weight, `text-slate-700`) + "TVET ERP" (extrabold, `text-primary`, large).
  2. **Sub-header:** "Empowering TVET Institutions with Smart ERP Solutions." (`text-slate-600`).
  3. **Feature cards grid** (`grid grid-cols-2 gap-3`) — 4 cards, each `bg-gray-100 rounded-xl p-4` with lucide icon (primary color) + label:
     - Database → "Centralize Institution Data"
     - Settings → "Optimize Resources"
     - BarChart3 → "Enhance Training Outcomes"
     - CalendarCheck → "Finalize Schedule Design"
  4. **Secondary header (lower):** "Welcome to TVET ERP" (`text-slate-800 font-semibold`) as a small footer line inside the card.
- Hidden below `lg` breakpoint (mobile shows only the login card over the photo).

### Right column (unchanged behavior, minor cleanup)
- Keep existing frosted login card: `bg-white/85 backdrop-blur-md rounded-2xl shadow-2xl`.
- Keep all form logic (email, password, show/hide, remember me, Forgot Password, Sign In, admin footer).
- No auth logic changes.

### Tokens / classes
- Solid white left = `bg-white` (per spec).
- Feature card bg = `bg-gray-100` (per spec).
- Remove the dark gradient overlay div entirely so no darker text layer can show through.

### Out of scope
- No backend, no route, no auth changes.
- No new assets (reuses existing `login-bg.png`).
