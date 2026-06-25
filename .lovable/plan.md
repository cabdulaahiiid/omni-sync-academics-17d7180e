## Goal

Change the trainer "Session Started / Check-In" step so:

1. The attendance check-in window opens during the **last 10 minutes of the scheduled session** (e.g. a 90-minute class → window opens at minute 80, closes at minute 90).
2. The countdown ring uses **server-supplied time**, not the trainer's device clock, so a wrong device clock cannot let a trainer check in early/late.

The geofence behavior, roster step, and end-session step are untouched.

## Files

- `src/lib/trainer.functions.ts` — add a tiny `getServerTime` server function that returns `{ now: string }` (ISO) using the DB clock (`select now()` via Supabase), and update `trainer_checkin` RPC call path is unchanged. Also remove the old 30-minute window from the client.
- `src/routes/_authenticated/ground/$scheduleId.tsx` — replace the device-clock `now` with a server-anchored clock and recompute `canStart` + countdown target around `endMs - 10 min`.
- (No DB migration; RPC `trainer_checkin` server-side window check is left alone for now — see "Server enforcement" below.)

## Client changes (`$scheduleId.tsx`)

1. **Server clock**

   - Add a query that calls `getServerTime` once on mount and every ~60s to compute a drift offset:
     ```
     offset = serverNowMs - Date.now()
     serverNow = () => Date.now() + offset
     ```
   - Replace `const [now, setNow] = useState(Date.now())` with a 1s tick that uses `serverNow()`.

2. **Window math (last 10 minutes of session)**

   Replace:
   ```
   canStart = now ∈ [startMs - 10m, startMs + 20m]
   ```
   with:
   ```
   windowOpenMs  = endMs - 10 * 60_000
   windowCloseMs = endMs
   canStart      = serverNow ∈ [windowOpenMs, windowCloseMs]
   ```

3. **Countdown ring target**

   In `CheckInStep`:
   - If `serverNow < windowOpenMs` → ring counts down to `windowOpenMs`, label "until window opens".
   - If `serverNow ∈ [windowOpenMs, windowCloseMs]` → ring counts down to `windowCloseMs`, label "to check in".
   - If `serverNow > windowCloseMs` → ring shows `00:00`, button disabled "Check-in window closed".

   Update the helper text from "Attendance window: 30 minutes from session start" to **"Attendance window: last 10 minutes of the session"**.

4. **Button disabled states** stay the same shape, just driven by the new `canStart`.

## Server changes (`trainer.functions.ts`)

Add:

```ts
export const getServerTime = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("now_iso"); // or select now() via a view
    return { now: (data as string) ?? new Date().toISOString() };
  });
```

If no `now_iso` RPC exists, fall back to `new Date().toISOString()` from the server function (still server time, just the Worker's clock instead of the DB's — acceptable for this UI gate). This avoids a migration.

## Server enforcement (note, not part of this change)

The RPC `trainer_checkin` currently rejects check-ins outside its own window. If that window is still "30 min from start", the new UI will let trainers press the button at minute 80 but the RPC will refuse. If that's the case we'll need a follow-up migration to update the RPC's window to `[end - 10m, end]`. I'll confirm by reading the RPC after you approve and include the migration in the same change if needed.

## Acceptance

- 90-minute session starting 10:00 → ring counts down to 11:20; at 11:20 the "Check-In Location" button enables; at 11:30 it disables again.
- Changing the device clock does not shift the window.
- No other steps (Setup, Roster, Done) change.
