/** The seven basic (behavioural) competencies rated on every final evaluation. */
export const BASIC_COMPETENCIES = [
  "Punctuality and attendance",
  "Discipline and work ethics",
  "Occupational health and safety",
  "Teamwork and communication",
  "Initiative and problem solving",
  "Care of tools, materials and equipment",
  "Quality of work and productivity",
] as const;

export type BasicCompetency = (typeof BASIC_COMPETENCIES)[number];
export type Rating = "GREEN" | "YELLOW" | "RED";
export const RATINGS: Rating[] = ["GREEN", "YELLOW", "RED"];
