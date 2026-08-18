/**
 * Mirror of the database evaluation maths (`ct_finalize_evaluation`).
 * Kept pure so the rules can be unit-tested and previewed in the UI before
 * an evaluator finalizes. The database remains the authority.
 */
export type Recommendation = "READY_FOR_ASSESSMENT" | "REMEDIAL_REQUIRED" | "REPEAT_PLACEMENT";

export type EvaluationSettings = {
  remedial_hours_per_failed_uc: number;
  remedial_hours_per_red_competency: number;
  max_red_competencies_for_assessment: number;
};

export type EvaluationInput = {
  ucResults: Array<"P" | "NP">;
  competencyRatings: Array<"GREEN" | "YELLOW" | "RED">;
};

export type EvaluationOutcome = {
  failedUcCount: number;
  redCompetencyCount: number;
  remedialHours: number;
  recommendation: Recommendation;
};

export function computeEvaluation(
  input: EvaluationInput,
  settings: EvaluationSettings,
): EvaluationOutcome {
  const total = input.ucResults.length;
  const failedUcCount = input.ucResults.filter((r) => r === "NP").length;
  const redCompetencyCount = input.competencyRatings.filter((r) => r === "RED").length;
  const remedialHours =
    failedUcCount * settings.remedial_hours_per_failed_uc +
    redCompetencyCount * settings.remedial_hours_per_red_competency;

  let recommendation: Recommendation;
  if (failedUcCount === 0 && redCompetencyCount <= settings.max_red_competencies_for_assessment) {
    recommendation = "READY_FOR_ASSESSMENT";
  } else if (total > 0 && failedUcCount / total >= 0.5) {
    recommendation = "REPEAT_PLACEMENT";
  } else {
    recommendation = "REMEDIAL_REQUIRED";
  }
  return { failedUcCount, redCompetencyCount, remedialHours, recommendation };
}

/** Great-circle distance in metres (same formula as the check-in RPC). */
export type DepartmentEvalConfig = {
  weight_daily: number;
  weight_industry: number;
  weight_tvet: number;
  passing_threshold: number;
  attendance_threshold: number;
  max_allowed_gaps: number;
};

export const DEFAULT_DEPARTMENT_CONFIG: DepartmentEvalConfig = {
  weight_daily: 40,
  weight_industry: 40,
  weight_tvet: 20,
  passing_threshold: 60,
  attendance_threshold: 80,
  max_allowed_gaps: 0,
};

export type DailyLog = {
  attendance: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  score?: number | null;
  safety_breach?: boolean;
};

export type CompositeInput = {
  logs: DailyLog[];
  industryScore: number;
  tvetScore: number;
  skillGapCount: number;
};

export type CompositeOutcome = {
  dailyAvgScore: number;
  attendanceRate: number;
  compositeScore: number;
  safetyBreachCount: number;
  color: "GREEN" | "YELLOW" | "RED";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mirror of `ct_finalize_evaluation`: composite score and 3-colour status. */
export function computeComposite(input: CompositeInput, cfg: DepartmentEvalConfig): CompositeOutcome {
  const scored = input.logs.filter((l) => typeof l.score === "number");
  const rawAvg = scored.length ? scored.reduce((s, l) => s + (l.score as number), 0) / scored.length : null;
  const dailyAvgScore = rawAvg === null ? round2(input.industryScore) : round2(((rawAvg - 1) / 4) * 100);
  const days = input.logs.length;
  const credited =
    input.logs.filter((l) => l.attendance === "PRESENT").length +
    0.5 * input.logs.filter((l) => l.attendance === "LATE").length;
  const attendanceRate = days > 0 ? round2((credited / days) * 100) : 100;
  const safetyBreachCount = input.logs.filter((l) => l.safety_breach).length;
  const compositeScore = round2(
    (cfg.weight_daily * dailyAvgScore + cfg.weight_industry * input.industryScore + cfg.weight_tvet * input.tvetScore) /
      100,
  );
  let color: CompositeOutcome["color"];
  if (compositeScore < cfg.passing_threshold || attendanceRate < cfg.attendance_threshold || safetyBreachCount > 0) {
    color = "RED";
  } else if (input.skillGapCount > cfg.max_allowed_gaps) {
    color = "YELLOW";
  } else {
    color = "GREEN";
  }
  return { dailyAvgScore, attendanceRate, compositeScore, safetyBreachCount, color };
}

/** Great-circle distance in metres (same formula as the check-in RPC). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
