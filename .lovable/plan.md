# Four targeted fixes: department label, trainer session flow, atomic user creation, department delete

## 1. Show the user's department in the sidebar/header

Today the sidebar top block reads "Jigjiga Polytechnic College / Department Head". It will read the department too:

```text
Jigjiga Polytechnic College
ICT · Department Head
```

- Return the signed-in user's department name from the current-user server function (resolved server-side from the department the user belongs to / leads).
- Show it in the Department Head shell sidebar and header role line, and in the Trainer app header role line (e.g. "ICT · Trainer"). Admin keeps "Master Admin".
- Users with no department fall back to the current text — no blank separator.

## 2. Trainer session flow: proceed → geofence → full-session countdown

Current behaviour blocks the check-in button until the last 10 minutes of the session, and the ring counts down 10 minutes.

New behaviour:
- After selecting Mode + Session Plan + Learning Outcome, "Proceed to Check-In" moves to the geofence step (unchanged).
- Geofence OFF globally (or per-user bypass): no GPS request, check-in passes straight through.
- Geofence ON: check-in stays blocked until the trainer is inside the radius, with distance shown.
- Check-in is allowed at any point between the session's scheduled start and end time (server-anchored clock, not the device clock). Before the start it shows a countdown to start; after the end it shows "session ended".
- Once checked in, the ring counts down the exact scheduled session length — a 2-hour session starts at 120:00 and runs to the scheduled end time.
- Attendance roster still unlocks in the last 10 minutes of the session, labelled clearly so the trainer knows when it opens.
- The server-side check-in rule is widened to match (start → end window instead of the current narrow window), so the UI and database agree.

## 3. User registration saves everything or nothing

`createUserAccount` currently runs several independent writes (auth user, avatar move, profile, role, department-head link, trainer registry). If a later step fails, a half-created user remains.

- Move the profile + role + department-head/trainer-registry writes into a single database function so they commit or roll back together.
- If that transaction fails, the just-created login is removed and the avatar upload cleaned up, so no partial record survives.
- Validate everything (phone format, phone uniqueness, email uniqueness, required department for DH/Trainer) *before* creating anything, and return one clear error naming the exact field.
- On success the admin user list, contact book and trainer pool refresh immediately.

## 4. Deleting a department actually deletes it

Delete currently fails silently or errors because other records reference the department.

- A "Delete department" dialog first shows exactly what will be removed (levels, sections, students, trainers, schedules, drafts, module rows) with counts, and requires the admin to type the department name to confirm.
- Confirming runs one database function that removes the department and all dependent records in a single transaction, writes an audit-log entry recording the counts, and refreshes the list.
- The same "count → type-to-confirm → cascade" pattern is applied where a department delete is offered.

## Technical notes

- `getMe` in `src/lib/data.functions.ts` gains `departmentName`; consumed by `operational.tsx`, `strategic-shell.tsx`, `ground.tsx`.
- Trainer changes are confined to `src/routes/_authenticated/ground/$scheduleId.tsx` (window/ring maths) plus the `trainer_checkin` database function's time-window guard.
- New database functions: `admin_create_user_records(...)` (transactional profile/role/links) and `admin_delete_department(_id uuid, _confirm_name text)` returning deleted counts; both security definer, Master Admin only, with audit rows.
- No changes to schedule builder, approvals, or the cooperative-training module.
