import { describe, it, expect } from "bun:test";
import { getHomeForRoles } from "./auth-routing";

describe("getHomeForRoles", () => {
  it("prefers MA over DH and T", () => {
    expect(getHomeForRoles(["MA"])).toBe("/strategic");
    expect(getHomeForRoles(["MA", "DH"])).toBe("/strategic");
    expect(getHomeForRoles(["MA", "T"])).toBe("/strategic");
    expect(getHomeForRoles(["MA", "DH", "T"])).toBe("/strategic");
  });

  it("prefers DH over T", () => {
    expect(getHomeForRoles(["DH"])).toBe("/operational");
    expect(getHomeForRoles(["DH", "T"])).toBe("/operational");
  });

  it("falls back to T (/ground)", () => {
    expect(getHomeForRoles(["T"])).toBe("/ground");
  });

  it("returns null when no roles", () => {
    expect(getHomeForRoles([])).toBeNull();
  });
});