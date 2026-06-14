export type HealthInput = {
  attendance_pct: number;
  trainer_punctuality: number;
  geo_compliance: number;
  departments_reporting: number;
  departments_total: number;
  pending_approvals: number;
};

export type HealthScore = {
  score: number;
  badge: "Excellent" | "Good" | "Watch" | "Critical";
  tone: "ok" | "info" | "warn" | "crit";
  components: { label: string; value: number; weight: number }[];
};

export function computeHealthScore(input: HealthInput): HealthScore {
  const reporting = input.departments_total
    ? Math.round((input.departments_reporting / input.departments_total) * 100)
    : 0;
  const queuePenalty = Math.max(0, 100 - Math.min(100, input.pending_approvals * 4));

  const components = [
    { label: "Attendance", value: input.attendance_pct, weight: 0.30 },
    { label: "Punctuality", value: input.trainer_punctuality, weight: 0.20 },
    { label: "Geo compliance", value: input.geo_compliance, weight: 0.20 },
    { label: "Departments reporting", value: reporting, weight: 0.15 },
    { label: "Approval clearance", value: queuePenalty, weight: 0.15 },
  ];

  const score = Math.round(
    components.reduce((sum, c) => sum + c.value * c.weight, 0),
  );

  let badge: HealthScore["badge"] = "Critical";
  let tone: HealthScore["tone"] = "crit";
  if (score >= 85) { badge = "Excellent"; tone = "ok"; }
  else if (score >= 70) { badge = "Good"; tone = "info"; }
  else if (score >= 55) { badge = "Watch"; tone = "warn"; }

  return { score, badge, tone, components };
}

const KEY = "tvet:health:prev";

export function readPrevHealth(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch { return null; }
}

export function writeHealth(score: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, String(score)); } catch { /* ignore */ }
}