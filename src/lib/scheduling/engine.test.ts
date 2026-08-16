import { describe, expect, it } from "bun:test";
import { generatePlan, groupByWeek, requiredSessions, type PlanParams } from "./engine";

const base: PlanParams = {
  module_total_minutes: 40 * 60,
  session_minutes: 120,
  sessions_per_week: 3,
  delivery: "Theory",
  theory_days: ["MON", "TUE", "WED"],
  practical_days: [],
  start_date: "2026-09-07", // Monday
  start_time: "08:00",
  term_end_date: "2027-06-30",
};

describe("requiredSessions", () => {
  it("divides exactly", () => {
    expect(requiredSessions(40 * 60, 120)).toEqual({ count: 20, final_minutes: 120 });
  });
  it("adds one short final session for a remainder", () => {
    expect(requiredSessions(45 * 60, 120)).toEqual({ count: 23, final_minutes: 60 });
  });
  it("handles a one-hour module", () => {
    expect(requiredSessions(60, 120)).toEqual({ count: 1, final_minutes: 60 });
  });
});

describe("generatePlan", () => {
  it("generates exactly the required sessions and hours (40h @ 2h)", () => {
    const r = generatePlan(base);
    expect(r.ok).toBe(true);
    expect(r.total_sessions).toBe(20);
    expect(r.total_minutes).toBe(40 * 60);
    expect(r.shortfall_minutes).toBe(0);
  });

  it("makes the final session shorter when hours do not divide (45h @ 2h)", () => {
    const r = generatePlan({ ...base, module_total_minutes: 45 * 60 });
    expect(r.total_sessions).toBe(23);
    expect(r.total_minutes).toBe(45 * 60);
    expect(r.sessions[r.sessions.length - 1].minutes).toBe(60);
    expect(r.sessions.slice(0, -1).every((s) => s.minutes === 120)).toBe(true);
  });

  it("numbers sessions sequentially and chronologically", () => {
    const r = generatePlan(base);
    expect(r.sessions.map((s) => s.session_number)).toEqual(r.sessions.map((_, i) => i + 1));
    const dates = r.sessions.map((s) => s.date + s.start_time);
    expect([...dates].sort()).toEqual(dates);
  });

  it("derives the end date from the last generated session", () => {
    const r = generatePlan(base);
    expect(r.end_date).toBe(r.sessions[r.sessions.length - 1].date);
  });

  it("derives weeks from sessions with W1 as the module's first teaching week", () => {
    const r = generatePlan(base);
    expect(r.sessions[0].week_num).toBe(1);
    expect(r.weeks).toBe(groupByWeek(r.sessions).length);
    expect(r.weeks).toBe(Math.ceil(20 / 3));
  });

  it("honours one session per week", () => {
    const r = generatePlan({ ...base, module_total_minutes: 8 * 60, sessions_per_week: 1 });
    expect(r.total_sessions).toBe(4);
    expect(r.weeks).toBe(4);
    expect(groupByWeek(r.sessions).every((w) => w.sessions.length === 1)).toBe(true);
  });

  it("stacks multiple sessions per day back-to-back when the week needs more than its days", () => {
    const r = generatePlan({
      ...base, module_total_minutes: 8 * 60, sessions_per_week: 4, theory_days: ["MON", "TUE"],
    });
    const byDate = groupByWeek(r.sessions)[0].sessions.filter((s) => s.date === r.sessions[0].date);
    expect(byDate.length).toBe(2);
    expect(byDate[0].start_time).toBe("08:00:00");
    expect(byDate[1].start_time).toBe("10:00:00");
  });

  it("crosses month and year boundaries", () => {
    const r = generatePlan({ ...base, module_total_minutes: 200 * 60, start_date: "2026-12-21" });
    expect(r.end_date!.slice(0, 4)).toBe("2027");
    expect(new Set(r.sessions.map((s) => s.date.slice(0, 7))).size).toBeGreaterThan(2);
  });

  it("never schedules outside the selected teaching days", () => {
    const r = generatePlan({ ...base, theory_days: ["SAT", "SUN"], sessions_per_week: 2 });
    expect(r.sessions.every((s) => s.day === "SAT" || s.day === "SUN")).toBe(true);
  });

  it("reports a shortfall when the term ends first", () => {
    const r = generatePlan({ ...base, module_total_minutes: 400 * 60, term_end_date: "2026-10-05" });
    expect(r.ok).toBe(false);
    expect(r.shortfall_minutes).toBeGreaterThan(0);
    expect(r.errors.join(" ")).toContain("term ends");
  });

  it("is deterministic: same input, same output", () => {
    expect(generatePlan(base)).toEqual(generatePlan(base));
  });

  it("regenerates different sessions when a parameter changes", () => {
    const a = generatePlan(base);
    const b = generatePlan({ ...base, start_date: "2026-09-14" });
    expect(b.sessions[0].date).not.toBe(a.sessions[0].date);
    expect(b.end_date).not.toBe(a.end_date);
  });

  it("marks practical days with the practical mode", () => {
    const r = generatePlan({
      ...base, delivery: "Both", theory_days: ["MON"], practical_days: ["WED"], sessions_per_week: 2,
    });
    expect(r.sessions.find((s) => s.day === "WED")!.mode).toBe("Practical");
    expect(r.sessions.find((s) => s.day === "MON")!.mode).toBe("Theory");
  });

  it("rejects empty required inputs", () => {
    expect(generatePlan({ ...base, theory_days: [] }).errors.length).toBeGreaterThan(0);
    expect(generatePlan({ ...base, session_minutes: 0 }).errors.length).toBeGreaterThan(0);
    expect(generatePlan({ ...base, module_total_minutes: 0 }).errors.length).toBeGreaterThan(0);
  });
});