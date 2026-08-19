# App shell harmonization, navigation bar, and department-trainer sync

## 1. One persistent shell for every screen

Today `/operational` renders its own sidebar + header, while `/cooperative-training` renders a standalone full-screen page with only a tab strip — so entering Industrial Practical Training loses the sidebar and top bar.

- Extract the existing `/operational` chrome (fixed 64-wide sidebar, mobile drawer, sticky top bar with logo, breadcrumbs, notifications bell, role switcher, profile chip, offline banner, `flex-1 overflow-y-auto` main) into a reusable `AppShell` component at `src/components/erp/app-shell.tsx`. Visuals stay byte-for-byte identical — it is a move, not a redesign.
- `operational.tsx` renders `<AppShell nav={dhNav}>` with its current items.
- `cooperative-training.tsx` renders the same `<AppShell>` (same nav list, including the "Industrial Practical Training" entry) and keeps its section tab strip inside the content area.
- Sidebar active state: the practical-training item highlights for `/cooperative-training` and every child route (prefix match), and the CT tab strip keeps its own exact/prefix logic.
- Access rules, role gating and redirects stay exactly as they are.

## 2. Universal sub-header (`NavHeader`)

New `src/components/erp/nav-header.tsx`, rendered at the top of the content area on CT screens (and available to other screens):

- Back button using the router history (`router.history.back()`), hidden when there is nothing to go back to.
- Dynamic breadcrumb stack reusing the existing `Breadcrumbs` component, with labels added for the practical-training paths: Industrial Practical Training, Requests, Supervisor queue, Director review, Placements, Logbooks, Supervision, Evaluation, Reports, Skill gaps, Department setup, Industry trainer.
- Page title plus an optional slot for status badges / page actions, so every CT screen gets the same title placement.

## 3. Department-scoped trainer data

- New `src/lib/ct/trainers.functions.ts` exposing `listCtDepartmentTrainers({ department_id })`. It resolves the caller's department context (Department Head's own department; Admin/Supervisor may pass one), verifies access with the existing department-access check, and reuses the existing `listDepartmentTrainers` helper so trainers linked through multi-department assignments are included.
- For each trainer it returns: current assigned-trainee load (count of active placements where they are the visiting trainer), availability derived from that load, and the department competency tags they cover.
- **Placements screen**: add an "Assigned trainer" column with an inline dropdown listing only that placement's department trainers (name · current load). Saving writes the existing `visiting_trainer_id` on the placement through a new guarded server function, which re-checks department access and blocks edits on locked placements. This is the link between student, enterprise and department trainer.
- **Requests screen**: add a read-only "Department trainer capacity" panel next to the request form, driven by the same query and filtered to the request's department, so the DH sees who is available before allocating.

## Technical notes

- No database migration is needed: `ct_student_placements.visiting_trainer_id` already exists and `allocateCtRoster` already accepts it; only a small update server function is added.
- All trainer reads run through server functions under existing RLS — no widening of who can see what.
- Files touched: new `app-shell.tsx`, `nav-header.tsx`, `ct/trainers.functions.ts`; edited `operational.tsx`, `cooperative-training.tsx`, CT `requests.tsx` / `placements.tsx`, and `breadcrumbs.tsx` label map.
