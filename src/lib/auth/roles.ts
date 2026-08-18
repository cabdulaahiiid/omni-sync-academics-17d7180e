export type AppRole = "MA" | "DH" | "T" | "IPS" | "PD";

export const ROLE_LABELS: Record<AppRole, string> = {
  MA: "Admin",
  DH: "Department Head",
  T: "Trainer",
  IPS: "Industrial Practical Supervisor",
  PD: "Program Director",
};

export const ROLE_HOME: Record<AppRole, "/strategic" | "/operational" | "/ground" | "/cooperative-training"> = {
  MA: "/strategic",
  DH: "/operational",
  T: "/ground",
  IPS: "/cooperative-training",
  PD: "/cooperative-training",
};

export function pickHome(roles: AppRole[] | undefined | null) {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("MA")) return ROLE_HOME.MA;
  if (roles.includes("DH")) return ROLE_HOME.DH;
  if (roles.includes("T")) return ROLE_HOME.T;
  if (roles.includes("IPS")) return ROLE_HOME.IPS;
  if (roles.includes("PD")) return ROLE_HOME.PD;
  return null;
}

export function roleLabel(roles: AppRole[] | undefined | null) {
  if (!roles || roles.length === 0) return "User";
  if (roles.includes("MA")) return ROLE_LABELS.MA;
  if (roles.includes("DH")) return ROLE_LABELS.DH;
  if (roles.includes("T")) return ROLE_LABELS.T;
  if (roles.includes("IPS")) return ROLE_LABELS.IPS;
  if (roles.includes("PD")) return ROLE_LABELS.PD;
  return "User";
}