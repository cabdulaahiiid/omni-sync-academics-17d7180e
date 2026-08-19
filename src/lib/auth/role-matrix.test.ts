import { describe, expect, it } from "bun:test";
import { CODE_TO_ROLE, ROLE_CODES, UserRole, roleLabel, codeLabel } from "./roles";
import { canAccess, codesFor } from "./role-matrix";

describe("role registry", () => {
  it("maps every identifier back from its database code", () => {
    for (const [role, codes] of Object.entries(ROLE_CODES)) {
      for (const c of codes) expect(CODE_TO_ROLE[c]).toBe(role as UserRole);
    }
  });

  it("has no login code for the automated actor", () => {
    expect(ROLE_CODES[UserRole.SYSTEM_ENGINE]).toEqual([]);
  });

  it("labels by precedence", () => {
    expect(roleLabel(["T", "MA"])).toBe("System Administrator");
    expect(roleLabel([])).toBe("User");
    expect(codeLabel("IPS")).toBe("Industrial Practitioners Supervisor");
  });
});

describe("module access matrix", () => {
  it("gates the supervisor queue to IPS and admins", () => {
    expect(codesFor("ctSupervisorQueue").sort()).toEqual(["IPS", "MA"]);
    expect(canAccess("ctSupervisorQueue", ["DH"])).toBe(false);
    expect(canAccess("ctSupervisorQueue", ["IPS"])).toBe(true);
  });

  it("keeps director review for PD", () => {
    expect(canAccess("ctDirectorReview", ["PD"])).toBe(true);
    expect(canAccess("ctDirectorReview", ["IPS"])).toBe(false);
  });

  it("gives the industry app to enterprise trainers only", () => {
    expect(canAccess("industryApp", ["EM"])).toBe(true);
    expect(canAccess("industryApp", ["DH"])).toBe(false);
  });
});
