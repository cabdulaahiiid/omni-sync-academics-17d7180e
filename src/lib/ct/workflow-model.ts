/** Pure workflow rules mirrored from the database guards. */

export type CtStatus =
  | "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "UNDER_IPS_REVIEW"
  | "DELEGATED_TO_PD" | "PD_REVIEW" | "PD_APPROVED" | "IPS_FINAL_APPROVAL"
  | "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION"
  | "DELEGATED" | "ALLOCATED" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export const IPS_ACTIONABLE: CtStatus[] = [
  "PENDING_APPROVAL", "UNDER_IPS_REVIEW", "PD_APPROVED", "IPS_FINAL_APPROVAL",
];
export const PD_ACTIONABLE: CtStatus[] = ["DELEGATED_TO_PD", "PD_REVIEW"];
export const IPS_DELEGATABLE: CtStatus[] = ["PENDING_APPROVAL", "UNDER_IPS_REVIEW"];

export const CONFLICT_MESSAGE =
  "This request was already updated by someone else — refresh to see the current status.";

export function canIpsDecide(status: string) {
  return IPS_ACTIONABLE.includes(status as CtStatus);
}
export function canIpsDelegate(status: string) {
  return IPS_DELEGATABLE.includes(status as CtStatus);
}
export function canPdDecide(status: string) {
  return PD_ACTIONABLE.includes(status as CtStatus);
}

export function nextIpsStatus(decision: "APPROVE" | "REJECT" | "RETURN"): CtStatus {
  return decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED_FOR_CORRECTION";
}
export function nextPdStatus(decision: "APPROVE" | "REJECT" | "RETURN"): CtStatus {
  return decision === "APPROVE" ? "PD_APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED_FOR_CORRECTION";
}

/** Optimistic-concurrency check applied before any workflow write. */
export function versionConflict(current: number, expected: number | null | undefined) {
  return expected !== null && expected !== undefined && expected !== current;
}

export function isConflictError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("already updated by someone else");
}
