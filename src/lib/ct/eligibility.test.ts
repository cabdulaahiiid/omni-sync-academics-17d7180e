import { describe, it, expect } from "bun:test";
import { evaluateTrainee, manualInitiationNote, theoryPercent } from "./eligibility";

describe("theory eligibility", () => {
  it("computes a rounded percentage from attendance", () => {
    expect(theoryPercent({ present: 8, all: 10 })).toBe(80);
    expect(theoryPercent({ present: 7, all: 9 })).toBe(78);
    expect(theoryPercent({ present: 0, all: 0 })).toBeNull();
    expect(theoryPercent(undefined)).toBeNull();
  });

  it("marks a trainee at or above the threshold eligible", () => {
    const r = evaluateTrainee({ present: 8, all: 10 }, { threshold: 80, alreadyPlaced: false });
    expect(r.eligible).toBe(true);
    expect(r.requires_override).toBe(false);
    expect(r.can_manually_select).toBe(true);
  });

  it("keeps a below-threshold trainee selectable but flags an override", () => {
    const r = evaluateTrainee({ present: 5, all: 10 }, { threshold: 80, alreadyPlaced: false });
    expect(r.theory_percent).toBe(50);
    expect(r.eligible).toBe(false);
    expect(r.can_manually_select).toBe(true);
    expect(r.requires_override).toBe(true);
  });

  it("keeps a trainee with no theory record selectable as a manual override", () => {
    const r = evaluateTrainee(null, { threshold: 80, alreadyPlaced: false });
    expect(r.theory_percent).toBeNull();
    expect(r.can_manually_select).toBe(true);
    expect(r.requires_override).toBe(true);
  });

  it("blocks a trainee who already has an active placement", () => {
    const r = evaluateTrainee({ present: 10, all: 10 }, { threshold: 80, alreadyPlaced: true });
    expect(r.eligible).toBe(false);
    expect(r.can_manually_select).toBe(false);
    expect(r.requires_override).toBe(false);
  });

  it("uses the configured threshold in the manual initiation note", () => {
    expect(manualInitiationNote(80)).toBe("MANUALLY INITIATED — THEORY < 80%");
    expect(manualInitiationNote(70)).toBe("MANUALLY INITIATED — THEORY < 70%");
  });
});
