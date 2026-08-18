# Industrial Practical Training — Access, Concurrency, Tests, and Workspace Screens

## 1. Make the request button reachable, Industrial Department only

Confirmed in the code: the Department Head sidebar (`/operational`) has no link to the practical-training module at all, so an Industrial DH can never reach the "New practical training request" form even though the form itself already exists on the Requests page.

- Add an "Industrial Practical Training" item to the DH sidebar that appears **only** when the signed-in DH heads the Industrial Department (resolved server-side, not from a name typed in the browser).
- Same rule on the module's own tab bar and on the Requests page: the create form renders for the Industrial DH, Admin and the Supervisor; other DHs who reach the URL see the module read-only for their own department and no create form.
- The Department picker in the create form is locked to the Industrial Department for a DH (Admin keeps the full list), so a DH cannot file a request for another department.
- Full form treatment applied to every practical-training form (create request, supervisor decision, director decision, placement, supervision visit, evaluation): required-field markers, sample-value placeholders, the standard validate → save → confirm → refresh → close behaviour, and the plain-language error panel used elsewhere in the ERP.

## 2. Server-side concurrency control on approvals and delegations

Two supervisors acting on the same request at the same moment must not both succeed.

- Every request carries a version counter that increments on each workflow transition.
- The screen sends the version it displayed along with the action. The database function locks the request row, re-reads the current status and version, and rejects the action with a clear message ("This request was already updated by someone else — refresh to see the current status") when they no longer match.
- The same guard covers approve, reject, return for correction, delegate, start review, director decisions and the director's bulk return. The bulk return reports per-request outcome (applied / skipped because already changed).
- Each successful transition still writes one audit row; a rejected concurrent attempt writes no state change.

## 3. Automated cross-department isolation checks

A test suite that signs in as different roles and asserts the database refuses out-of-scope reads and writes:

- An Industrial DH cannot read another department's requests, placements, request members, or decision history.
- A non-Industrial DH cannot see or create Industrial practical-training requests.
- A Program Director sees only requests delegated to them, nothing else.
- An Industrial Trainer sees only assigned trainees, placements and logbooks, and cannot approve or delegate.
- Direct ID tampering (calling a workflow function with someone else's request id) is refused.

## 4. End-to-end workflow test suite

- 80% theory bypass: an Industrial DH can select a below-threshold trainee, the request is stamped "MANUALLY INITIATED — THEORY < 80%", the real percentage is stored, and approvers see the warning.
- Full flow: draft → submit → supervisor review → approve / reject / return, and the delegated path supervisor → director → back to supervisor → final approval.
- Concurrency: two simultaneous decisions on one request — one succeeds, one is refused.
- Persistence after refresh: every action's result is still correct after a page reload, not just in local state.

## 5. Remaining IPS and Program Director workspace screens

All wired to real stored data with role-based filtering enforced in the database:

- **Active placements** — trainee, enterprise, site, mentor, dates, status, day-1 check-in state; supervisor sees all Industrial placements, the director sees only placements under requests delegated to them, trainers only their assigned trainees.
- **Logbook monitoring** — submitted/approved/rejected daily entries per placement, hours logged versus expected, overdue and absence flags, drill-down into a trainee's entries.
- **Supervision** — scheduled and completed visits, findings, actions, evidence count, and gaps where no visit has been recorded.
- **Evaluation** — trainer and mentor evaluations, competency ratings, unit-of-competence pass/fail, final recommendation, and which trainees are ready to be pushed to assessment.
- **Reports** — placement, logbook compliance, supervision coverage and competency outcome summaries, filterable and exportable through the existing enterprise report/PDF template.

## Technical notes

- Migration: `version` (integer) on `ct_training_requests`; `ct_ips_decide_request`, `ct_ips_delegate_request`, `ct_ips_start_review`, `ct_pd_decide_request`, `ct_pd_start_review` and `ct_pd_bulk_return_to_ips` gain an `_expected_version` argument plus `SELECT ... FOR UPDATE` and a status/version re-check that raises a named conflict error. Read-side helpers for the new screens: placement/logbook/supervision/evaluation summaries respecting `ct_is_ips()`, `ct_is_program_director()`, `ct_is_industrial_dh()` and trainer assignment.
- New server functions in `src/lib/ct/`: `placements.functions.ts`, `logbook-monitor.functions.ts`, `supervision.functions.ts` (extend existing), `evaluation.functions.ts` (extend), `ct-reports.functions.ts` — each `requireSupabaseAuth` plus a role guard.
- New routes under `src/routes/_authenticated/cooperative-training/`: `placements.tsx`, `logbooks.tsx`, `supervision.tsx`, `evaluation.tsx`, `reports.tsx`, each with its own `head()` metadata and tab-bar entries filtered by role.
- `src/routes/_authenticated/operational.tsx`: conditional nav entry driven by a new `isIndustrialDh` flag returned from the server (`use-me` / a small server fn), never from a client-side name match.
- Tests: `src/lib/ct/*.test.ts` for pure workflow/eligibility logic, plus a Playwright end-to-end suite covering the flows in sections 3 and 4 against the running app.
- Existing tables, requests, placements, logbooks and evaluations remain untouched; no drops, no resets.
