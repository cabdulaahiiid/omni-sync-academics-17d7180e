## Global Geofence Toggle

Add a master ON/OFF switch for the campus geofence so admins can disable geofence enforcement system-wide, while keeping the existing per-trainer "Bypass geofence" flag for individual exceptions when it is ON.

### Database
- Add `geofence_enabled boolean not null default true` to `public.global_config`.

### Server / Enforcement
- Update `trainer_checkin` SQL function: if `global_config.geofence_enabled = false`, skip distance/radius validation entirely (and skip venue coordinate checks).
- Update `submit_session_batch` similarly so offline-synced sessions are not geo-rejected when the global toggle is off.
- Existing per-trainer `profiles.bypass_geofence` continues to work when the global toggle is ON.
- Update `getGlobalConfig` / `updateGlobalConfig` server functions to read/write the new field.

### UI — Strategic → Settings (`src/routes/_authenticated/strategic/settings.tsx`)
- Add a Switch labeled "Enforce campus geofence" at the top of the Campus geofence card.
  - ON → fields (lat/lng/radius) remain enabled and required; helper text: "Trainers must be inside this radius to start a session. Trainers with bypass enabled are exempt."
  - OFF → disable lat/lng/radius inputs (greyed out) and show helper text: "Geofence checks are disabled for ALL trainers. Sessions can be started from anywhere."
- Save persists `geofence_enabled` along with other settings.

### UI — Strategic → Users & Roles
- In the trainer row, when global geofence is OFF, show the per-trainer bypass toggle as disabled with tooltip "Global geofence is disabled — all trainers bypass".

### Out of scope
- No change to venue-level `geo_radius` storage.
- No change to login page or branding.
