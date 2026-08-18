/** Shared query keys for the cooperative & industrial training module. */
export const CT_KEYS = {
  overview: ["ct", "overview"] as const,
  curriculum: ["ct", "curriculum"] as const,
  enterprises: ["ct", "enterprises"] as const,
  requests: ["ct", "requests"] as const,
  request: (id: string) => ["ct", "request", id] as const,
  placements: ["ct", "placements"] as const,
  myTraining: ["ct", "my-training"] as const,
  mentorQueue: ["ct", "mentor-queue"] as const,
  logbook: (placementId: string) => ["ct", "logbook", placementId] as const,
  supervision: ["ct", "supervision"] as const,
  evaluations: ["ct", "evaluations"] as const,
  assessment: ["ct", "assessment"] as const,
};
