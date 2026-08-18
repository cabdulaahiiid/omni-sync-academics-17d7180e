import { describe, it, expect } from "bun:test";
import {
  canIpsDecide, canIpsDelegate, canPdDecide, isConflictError,
  nextIpsStatus, nextPdStatus, versionConflict, CONFLICT_MESSAGE,
} from "./workflow-model";

describe("practical training workflow", () => {
  it("lets the supervisor act only on requests awaiting them", () => {
    expect(canIpsDecide("PENDING_APPROVAL")).toBe(true);
    expect(canIpsDecide("UNDER_IPS_REVIEW")).toBe(true);
    expect(canIpsDecide("PD_APPROVED")).toBe(true);
    expect(canIpsDecide("DRAFT")).toBe(false);
    expect(canIpsDecide("APPROVED")).toBe(false);
  });

  it("only allows delegation while the supervisor still holds the request", () => {
    expect(canIpsDelegate("UNDER_IPS_REVIEW")).toBe(true);
    expect(canIpsDelegate("DELEGATED_TO_PD")).toBe(false);
    expect(canIpsDelegate("APPROVED")).toBe(false);
  });

  it("lets the director act only on delegated requests", () => {
    expect(canPdDecide("DELEGATED_TO_PD")).toBe(true);
    expect(canPdDecide("PD_REVIEW")).toBe(true);
    expect(canPdDecide("PENDING_APPROVAL")).toBe(false);
  });

  it("maps decisions to the correct next status", () => {
    expect(nextIpsStatus("APPROVE")).toBe("APPROVED");
    expect(nextIpsStatus("REJECT")).toBe("REJECTED");
    expect(nextIpsStatus("RETURN")).toBe("RETURNED_FOR_CORRECTION");
    expect(nextPdStatus("APPROVE")).toBe("PD_APPROVED");
    expect(nextPdStatus("RETURN")).toBe("RETURNED_FOR_CORRECTION");
  });

  it("detects a stale version so two approvers cannot both win", () => {
    expect(versionConflict(3, 3)).toBe(false);
    expect(versionConflict(4, 3)).toBe(true);
    expect(versionConflict(3, null)).toBe(false);
  });

  it("recognises the conflict message coming back from the database", () => {
    expect(isConflictError(new Error(CONFLICT_MESSAGE))).toBe(true);
    expect(isConflictError(new Error("Request not found."))).toBe(false);
  });
});
