# Multi-Role Practical Training Pipeline — Staged Build

Decisions locked from your answers: the Coordinator is the existing Industrial Practitioners Supervisor role, relabelled and extended (no new role code, no data migration); all screens stay on their current URLs; the enterprise portal grows out of the existing industry trainer app.

## Stage 1 (this build): Curriculum master + nested schedule sessions

### Pillar 1 — Admin practical template on a module
On the Module registry (Admin > Modules), each module gets a "Practical template" editor:

- A module opens into a template panel listing **Practical sessions** (name, allocated hours, optional venue hint).
- Each session holds **Sub-sessions / tasks** (task title, competency code, practical description).
- Sessions and sub-sessions are reorderable and can be deactivated.
- The editor appears for modules typed Practical or Both; a Theory module shows an inline note instead.
- Saved templates become the pool that Department Heads and the Coordinator draw from.

### Pillar 2 — Schedule Builder nested session engine
In the Schedule Builder, when Delivery Type is Practical or Both:

- A nested builder appears below the delivery selection, pre-filled from the selected module's practical template.
- Parent rows: session name, allocated hours, venue. Child rows: task title, competency code, description.
- The Department Head can add, edit, remove or re-order rows for this plan without changing the master template.
- Hours roll up and are compared against the plan's practical minutes; a mismatch shows as a warning, not a hard block.
- Saving a draft or submitting for approval stores the structured tree with the plan and attaches it to the department's Industrial Training Request, so downstream roles see the exact task list.
- Theory-only plans behave exactly as today.

### Verification for Stage 1
1. Create a Practical module, add 2 sessions and 3 sub-sessions, reload — the template persists.
2. Build a schedule for that module with Delivery = Both — the nested builder pre-fills from the template.
3. Save as draft, reopen the draft — nested sessions come back unchanged.
4. Submit for approval — the request carries the session/sub-session tree.
5. A Theory module shows no nested builder and saves as before.

## Stages 2–3 (after Stage 1 is approved and verified)

- **Coordinator portal** — the practical-training workspace becomes the Coordinator's home: cross-department request hub, enterprise liaison and capacity management, and an assignment dispatcher that matches student groups to enterprises and assigns both a college trainer and an enterprise trainer. Label and feature changes only; existing routes and permissions stay.
- **Enterprise portal** — the industry trainer app gains a workplace roster, sub-session logbook sign-off tied to the tasks defined in Stage 1, site attendance and workplace evaluation, and keeps its offline sync.
- **Dynamic unlocking for TVET trainers** — a trainer sees the Industrial Practical Training area only while they hold an active practical placement assignment; otherwise it is hidden from the sidebar and blocked on direct navigation.

## Technical notes

- New tables `module_practical_sessions` and `module_practical_tasks` (module-scoped master template) plus `schedule_plan_practical_sessions` / `..._tasks` for the per-plan copy, each with grants, RLS scoped by department, and updated-at triggers. Admins write the master; Department Heads write only their own department's plan copy; practical-training roles read.
- Template CRUD and plan-tree persistence go through `createServerFn` modules (`src/lib/modules.functions.ts`, `src/lib/semester-builder.functions.ts`) behind `requireSupabaseAuth` + `requireRole`; the atomic plan save extends the existing `dh_save_schedule_plan` RPC so the tree lands in the same transaction as the sessions.
- Coordinator relabelling in Stage 2 stays confined to `src/lib/auth/roles.ts` and `role-matrix.ts`; the `IPS` database code is untouched.
- Trainer unlocking in Stage 3 is a server-side assignment check feeding the nav matrix plus a route guard, not a client-only hide.