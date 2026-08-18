/** Pure theory-eligibility rules shared by the server and the tests. */

export type AttendanceTotals = { present: number; all: number };

export function theoryPercent(totals: AttendanceTotals | undefined | null): number | null {
  if (!totals || totals.all <= 0) return null;
  return Math.round((totals.present / totals.all) * 100);
}

export type TraineeEligibility = {
  theory_percent: number | null;
  already_placed: boolean;
  /** Meets the theory threshold and is free to be placed. */
  eligible: boolean;
  /** A Department Head may still add this trainee, flagging a manual initiation. */
  can_manually_select: boolean;
  /** Selecting this trainee stamps the request MANUALLY INITIATED. */
  requires_override: boolean;
};

export function evaluateTrainee(
  totals: AttendanceTotals | undefined | null,
  opts: { threshold: number; alreadyPlaced: boolean },
): TraineeEligibility {
  const percent = theoryPercent(totals);
  const eligible = percent !== null && percent >= opts.threshold && !opts.alreadyPlaced;
  return {
    theory_percent: percent,
    already_placed: opts.alreadyPlaced,
    eligible,
    // The 80% theory rule is a warning, never a block: only an existing
    // placement prevents selection.
    can_manually_select: !opts.alreadyPlaced,
    requires_override: !opts.alreadyPlaced && !eligible,
  };
}

export const MANUAL_INITIATION_NOTE = "MANUALLY INITIATED — THEORY < 80%";

export function manualInitiationNote(threshold: number) {
  return `MANUALLY INITIATED — THEORY < ${threshold}%`;
}
