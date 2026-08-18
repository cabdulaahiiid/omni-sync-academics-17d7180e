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
