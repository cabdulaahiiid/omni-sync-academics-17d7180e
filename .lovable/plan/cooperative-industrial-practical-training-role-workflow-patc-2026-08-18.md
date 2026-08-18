# Cooperative & Industrial Practical Training — Role & Workflow Patch

Incremental patch on the existing module. No rebuild, no data loss, no table drops.

## What I confirmed in the current system
- A department record named **INDUSTRIAL DEPARTMENT** already exists and will be used as the anchor (no new department created).
- Roles today: MA, DH, T, PD, CO, VT, EM, TR. **PD is already present and will serve as Program Director**; **IPS does not exist yet** and must be added.
- Request states today: DRAFT, SUBMITTED, DELEGATED, ALLOCATED, SCHEDULED, ACTIVE, COMPLETED, CANCELLED — no IPS review, PD review, rejection or correction states.
- Eligibility is computed server-side from attendance and the trainee checkbox is **disabled** below the theory threshold — this is the hard block to remove.
- A delegation history table (`ct_request_delegations`) and a workflow event log already exist and will be reused.

## 1. Theory 80% becomes a warning, not a block
- Trainees below the threshold stay selectable for an Industrial DH (and Admin/IPS). Per trainee we store the real theory %, the eligibility flag, and a new manual-override marker.
- Requests containing below-threshold trainees are stamped `MANUALLY INITIATED — THEORY < 80%` and show the warning banner. Nothing is faked as 80%.
- Approvers see the warning and exact per-trainee percentages before deciding; the request follows the normal approval flow.

## 2. New roles
- Add **IPS (Industrial Practical Supervisor)** as a real system role, alongside existing **PD (Program Director)**.
- Both appear in Admin > Users & Roles so Admin can create and manage such users like any other role. Neither receives Admin, DH or Trainer privileges.

## 3. Approval workflow (real states, server-enforced)
```text
DRAFT -> PENDING_APPROVAL -> UNDER_IPS_REVIEW
   -> IPS approves  -> APPROVED -> ALLOCATED/SCHEDULED -> ACTIVE -> COMPLETED
   -> IPS delegates -> DELEGATED_TO_PD -> PD_REVIEW -> PD_APPROVED -> IPS_FINAL_APPROVAL -> APPROVED
   -> REJECTED | RETURNED_FOR_CORRECTION (back to the Industrial DH)
```
- Every transition runs through one guarded database function that checks role + department + current status; arbitrary status jumps are rejected.
- The current status is re-checked at write time, so two approvers cannot double-process the same request.
- Every action writes an audit row: request, actor, role, department, action, previous status, new status, timestamp, comment, delegated-to.

## 4. Program Director bulk action
- PD gets a controlled "Return approved requests to IPS" bulk action, limited to requests delegated to that PD, with a confirmation dialog listing exactly which requests are affected, a required note, and per-request status recording. Already-processed requests are skipped.

## 5. Authorization model (backend first)
Access is decided by role + department + assignment + workflow status, enforced in database policies and workflow functions — not by hiding menus.
- **Industrial DH**: initiate/edit/withdraw requests for the Industrial Department only; sees that department's trainees, placements, schedules, monitoring.
- **Other DHs**: unchanged permissions; no visibility of Industrial practical-training records.
- **IPS**: full review authority over practical-training requests, placements, logbooks, supervision, evaluation, reports; may delegate to PD.
- **PD**: sees only requests delegated to them plus their own decision history.
- **Industrial Trainer**: acts only on trainees, placements, logbooks, supervision and evaluations assigned to them; no approve or delegate.
- URL/ID tampering is blocked because policies and functions re-check scope on every read and write.

## 6. Dashboards
- IPS workspace: incoming, pending, under review, delegated, PD decisions, approved, rejected, active, completed, placements, enterprises, logbook/supervision/evaluation monitoring, reports.
- PD workspace: assigned queue, awaiting action, review history, decisions.
- Industrial DH: department requests with full status trail and warnings.
- Industrial Trainer: assigned trainees, placements, logbooks, supervision only.
- Module navigation is filtered per role, backed by the server rules above.

## Technical notes
- Migration: add `IPS` to `app_role`; extend `ct_request_status` with `PENDING_APPROVAL`, `UNDER_IPS_REVIEW`, `DELEGATED_TO_PD`, `PD_REVIEW`, `PD_APPROVED`, `IPS_FINAL_APPROVAL`, `APPROVED`, `REJECTED`, `RETURNED_FOR_CORRECTION` (existing values kept); add `manual_override` and `override_reason` to `ct_training_request_students`; add a `ct_request_decisions` audit table with grants and RLS.
- New security-definer helpers: `ct_is_ips()`, `ct_is_program_director()`, `ct_is_industrial_dh()`, `ct_can_act_on_request(_request_id)`; existing `ct_*` policies updated to use them.
- New/updated RPCs: `ct_ips_decide_request`, `ct_ips_delegate_request`, `ct_pd_decide_request`, `ct_pd_bulk_return_to_ips` — all with status guards plus audit writes.
- Server functions in `src/lib/ct/*.functions.ts` get matching role guards; the eligibility function returns `eligible` plus `can_manually_select`.
- UI: new IPS and PD pages under `/cooperative-training`, warning banner and selectable below-threshold trainees on the Requests page, role-filtered tabs in the module shell.
- Existing tables, data, placements, logbooks and evaluations are left intact.