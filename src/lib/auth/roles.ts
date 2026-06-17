export type AppRole = "MA" | "DH" | "T";

export const ROLE_LABELS: Record<AppRole, string> = {
  MA: "Admin",
  DH: "Department Head",
  T: "Trainer",
};

export const ROLE_HOME: Record<AppRole, "/strategic" | "/operational" | "/ground"> = {
  MA: "/strategic",
  DH: "/operational",
  T: "/ground",
};

export function pickHome(roles: AppRole[] | undefined | null) {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("MA")) return ROLE_HOME.MA;
  if (roles.includes("DH")) return ROLE_HOME.DH;
  if (roles.includes("T")) return ROLE_HOME.T;
  return null;
}

export function roleLabel(roles: AppRole[] | undefined | null) {
  if (!roles || roles.length === 0) return "User";
  if (roles.includes("MA")) return ROLE_LABELS.MA;
  if (roles.includes("DH")) return ROLE_LABELS.DH;
  if (roles.includes("T")) return ROLE_LABELS.T;
  return "User";
}