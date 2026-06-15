## Plan to fix the post-login `/strategic` error

1. **Fix the remaining hook-order crash in the Strategic dashboard**
   - In `src/routes/_authenticated/strategic/index.tsx`, move the `meLoading` render branch below all React hooks.
   - The previous fix moved it below some hooks, but `insights` and `reportingStats` still use `useMemo` after the early return, so the page can still crash after login with “This page didn’t load”.
   - Keep the existing layout, colors, typography, dashboard sections, and navigation untouched.

2. **Audit the protected auth shell for token routing stability**
   - Confirm `src/start.ts` still registers the auth bearer attacher for protected server functions.
   - Confirm the protected layout redirects unauthenticated users to `/login` and allows authenticated users through.
   - Avoid changing the login UI or completed strategic shell unless a routing/auth defect is found.

3. **Verify the end-to-end flow**
   - Use the live app with the existing authenticated session to open `/strategic`.
   - Confirm the dashboard renders instead of the error page.
   - Spot-check main Strategic menu routes for no blank/error pages.
   - Confirm logout returns to `/login`.

4. **Scope guard**
   - Only touch the file(s) required to fix the route crash.
   - Do not redesign, replace, or restyle completed UI screens.