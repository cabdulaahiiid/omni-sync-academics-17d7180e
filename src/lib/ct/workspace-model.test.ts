import { describe, it, expect } from "bun:test";
import { evaluationOutcome, summariseLogbook, supervisionGap, workingDaysBetween } from "./workspace-model";

const placement = { start_date: "2026-03-02", end_date: "2026-03-13" }; // two full weeks, Mon-Fri

describe("workspace derivations", () => {
  it("counts working days only up to today", () => {
    expect(workingDaysBetween("2026-03-02", "2026-03-13", new Date("2026-03-31"))).toBe(10);
    expect(workingDaysBetween("2026-03-02", "2026-03-13", new Date("2026-03-06"))).toBe(5);
  });

  it("summarises logbook compliance and hours", () => {
    const entries = [
      { entry_date: "2026-03-02", hours: 8, status: "APPROVED" },
      { entry_date: "2026-03-03", hours: 7.5, status: "SUBMITTED" },
      { entry_date: "2026-03-04", hours: 8, status: "REJECTED" },
    ];
    const s = summariseLogbook(entries, placement, new Date("2026-03-13"));
    expect(s.total).toBe(3);
    expect(s.approved).toBe(1);
    expect(s.hours).toBe(23.5);
    expect(s.expectedDays).toBe(10);
    expect(s.missingDays).toBe(7);
    expect(s.compliance).toBe(30);
  });

  it("flags a placement with no supervision visit", () => {
    expect(supervisionGap([], placement).overdue).toBe(true);
    const recent = supervisionGap([{ visit_date: "2026-03-10" }], placement, new Date("2026-03-12"));
    expect(recent.overdue).toBe(false);
    expect(recent.lastVisit).toBe("2026-03-10");
    const stale = supervisionGap([{ visit_date: "2026-02-01" }], placement, new Date("2026-03-12"));
    expect(stale.overdue).toBe(true);
  });

  it("reports the latest evaluation outcome", () => {
    const out = evaluationOutcome([
      { finalized: false, recommendation: "REMEDIAL_REQUIRED", failed_uc_count: 2, red_competency_count: 1 },
      { finalized: true, recommendation: "READY_FOR_ASSESSMENT", failed_uc_count: 0, red_competency_count: 0 },
    ]);
    expect(out.finalized).toBe(1);
    expect(out.readyForAssessment).toBe(true);
    expect(out.failedUc).toBe(0);
  });
});
