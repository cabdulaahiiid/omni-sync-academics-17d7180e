/**
 * Canonical role registry.
 *
 * The database enum keeps its short codes (MA, DH, T, PD, IPS, EM, TR, …) so
 * no migration, RLS change or data rewrite is required. This module is the
 * single source of truth that maps those codes onto the enterprise role
 * identifiers and the human labels shown anywhere in the UI.
 */
export type AppRole = "MA" | "DH" | "T" | "IPS" | "PD" | "EM" | "TR";

/** Enterprise-standard role identifiers. */
export enum UserRole {
  SYSTEM_ADMIN = "SYSTEM_ADMIN",
  DEPARTMENT_HEAD = "DEPARTMENT_HEAD",
  INDUSTRIAL_PRACTITIONERS_SUPERVISOR = "INDUSTRIAL_PRACTITIONERS_SUPERVISOR",
  PROGRAM_DIRECTOR = "PROGRAM_DIRECTOR",
  TVET_TRAINER = "TVET_TRAINER",
  ENTERPRISE_TRAINER = "ENTERPRISE_TRAINER",
  /** Automated actor (jobs, dispatchers, detectors). Never assignable to a person. */
  SYSTEM_ENGINE = "SYSTEM_ENGINE",
}

/** Identifier -> database code(s). SYSTEM_ENGINE has no login code. */
export const ROLE_CODES: Record<UserRole, AppRole[]> = {
  [UserRole.SYSTEM_ADMIN]: ["MA"],
  [UserRole.DEPARTMENT_HEAD]: ["DH"],
  [UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR]: ["IPS"],
  [UserRole.PROGRAM_DIRECTOR]: ["PD"],
  [UserRole.TVET_TRAINER]: ["T"],
  [UserRole.ENTERPRISE_TRAINER]: ["EM", "TR"],
  [UserRole.SYSTEM_ENGINE]: [],
};

/** Database code -> identifier. */
export const CODE_TO_ROLE: Record<string, UserRole> = Object.entries(ROLE_CODES).reduce(
  (acc, [role, codes]) => {
    for (const c of codes) acc[c] = role as UserRole;
    return acc;
  },
  {} as Record<string, UserRole>,
);

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SYSTEM_ADMIN]: "System Administrator",
  [UserRole.DEPARTMENT_HEAD]: "Department Head",
  [UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR]: "Industrial Practitioners Supervisor",
  [UserRole.PROGRAM_DIRECTOR]: "Program Director",
  [UserRole.TVET_TRAINER]: "TVET Trainer",
  [UserRole.ENTERPRISE_TRAINER]: "Enterprise Trainer",
  [UserRole.SYSTEM_ENGINE]: "Automated System",
};

/** Label for a raw database role code. */
export const ROLE_LABELS: Record<AppRole, string> = {
  MA: USER_ROLE_LABELS[UserRole.SYSTEM_ADMIN],
  DH: USER_ROLE_LABELS[UserRole.DEPARTMENT_HEAD],
  IPS: USER_ROLE_LABELS[UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR],
  PD: USER_ROLE_LABELS[UserRole.PROGRAM_DIRECTOR],
  T: USER_ROLE_LABELS[UserRole.TVET_TRAINER],
  EM: USER_ROLE_LABELS[UserRole.ENTERPRISE_TRAINER],
  TR: USER_ROLE_LABELS[UserRole.ENTERPRISE_TRAINER],
};

/** Roles an administrator can assign to a person, in display order. */
export const ASSIGNABLE_ROLES = ["MA", "DH", "T", "IPS", "PD"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_HOME: Record<AppRole, "/strategic" | "/operational" | "/ground" | "/cooperative-training" | "/industry"> = {
  MA: "/strategic",
  DH: "/operational",
  T: "/ground",
  IPS: "/cooperative-training",
  PD: "/cooperative-training",
  EM: "/industry",
  TR: "/industry",
};

const HOME_PRIORITY: AppRole[] = ["MA", "DH", "T", "IPS", "PD", "EM", "TR"];

export function pickHome(roles: AppRole[] | string[] | undefined | null) {
  if (!roles || roles.length === 0) return null;
  const set = new Set(roles as string[]);
  for (const r of HOME_PRIORITY) if (set.has(r)) return ROLE_HOME[r];
  return null;
}

/** Human label for a set of database role codes (highest-precedence wins). */
export function roleLabel(roles: AppRole[] | string[] | undefined | null) {
  if (!roles || roles.length === 0) return "User";
  const set = new Set(roles as string[]);
  for (const r of HOME_PRIORITY) if (set.has(r)) return ROLE_LABELS[r];
  return "User";
}

/** Label for a single database role code. */
export function codeLabel(code: string) {
  return ROLE_LABELS[code as AppRole] ?? code;
}
