import { describe, it, expect } from "bun:test";
import { requireRole, ForbiddenError } from "./require-role";

function makeCtx(roles: string[]) {
  return {
    userId: "user-1",
    supabase: {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          insert: async () => ({ error: null }),
          then(resolve: any) {
            resolve({ data: roles.map((role) => ({ role })), error: null });
          },
        } as any;
      },
    } as any,
  };
}

describe("requireRole", () => {
  it("allows when user has one of the required roles", async () => {
    const ctx = makeCtx(["DH"]);
    const result = await requireRole(ctx, ["MA", "DH"], "test");
    expect(result).toContain("DH");
  });

  it("throws ForbiddenError when user lacks required roles", async () => {
    const ctx = makeCtx(["T"]);
    let caught: unknown = null;
    try {
      await requireRole(ctx, ["MA"], "test");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForbiddenError);
    expect((caught as ForbiddenError).status).toBe(403);
  });

  it("throws when user has no roles at all", async () => {
    const ctx = makeCtx([]);
    let caught: unknown = null;
    try {
      await requireRole(ctx, ["MA", "DH", "T"], "test");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForbiddenError);
  });
});