import { ROLE_CODES, UserRole, type AppRole } from "@/lib/auth/roles";

/**
 * Declarative UI access matrix: module -> roles allowed to see it.
 *
 * This drives navigation visibility only. Server-side enforcement stays with
 * the existing `requireRole` guards, security-definer functions and RLS
 * policies, which continue to use the database role codes.
 */
export const MODULE_ACCESS = {
  strategic: [UserRole.SYSTEM_ADMIN],
  operational: [UserRole.DEPARTMENT_HEAD, UserRole.SYSTEM_ADMIN],
  trainerApp: [UserRole.TVET_TRAINER, UserRole.DEPARTMENT_HEAD, UserRole.SYSTEM_ADMIN],
  industryApp: [UserRole.ENTERPRISE_TRAINER],

  ctOverview: [
    UserRole.SYSTEM_ADMIN,
    UserRole.DEPARTMENT_HEAD,
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.TVET_TRAINER,
    UserRole.ENTERPRISE_TRAINER,
  ],
  ctRequests: [UserRole.DEPARTMENT_HEAD, UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR, UserRole.SYSTEM_ADMIN],
  ctSupervisorQueue: [UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR, UserRole.SYSTEM_ADMIN],
  ctDirectorReview: [UserRole.PROGRAM_DIRECTOR, UserRole.SYSTEM_ADMIN],
  ctPlacements: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.TVET_TRAINER,
    UserRole.DEPARTMENT_HEAD,
    UserRole.SYSTEM_ADMIN,
  ],
  ctLogbooks: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.TVET_TRAINER,
    UserRole.SYSTEM_ADMIN,
  ],
  ctSupervision: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.TVET_TRAINER,
    UserRole.SYSTEM_ADMIN,
  ],
  ctEvaluation: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.TVET_TRAINER,
    UserRole.SYSTEM_ADMIN,
  ],
  ctReports: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.SYSTEM_ADMIN,
  ],
  ctGaps: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.SYSTEM_ADMIN,
  ],
  ctSettings: [UserRole.DEPARTMENT_HEAD, UserRole.SYSTEM_ADMIN],

  /** Enterprise / industry trainer logbook portal. */
  enterprisePortal: [UserRole.ENTERPRISE_TRAINER, UserRole.SYSTEM_ADMIN],
  /** Cross-department coordinator hub (DH sees only their own department). */
  coordinatorDashboard: [
    UserRole.INDUSTRIAL_PRACTITIONERS_SUPERVISOR,
    UserRole.PROGRAM_DIRECTOR,
    UserRole.DEPARTMENT_HEAD,
    UserRole.SYSTEM_ADMIN,
  ],
} satisfies Record<string, UserRole[]>;

export type ModuleKey = keyof typeof MODULE_ACCESS;

/** Database codes allowed for a module. */
export function codesFor(module: ModuleKey): AppRole[] {
  return MODULE_ACCESS[module].flatMap((r) => ROLE_CODES[r]);
}

/** Does a user holding these database role codes get this module? */
export function canAccess(module: ModuleKey, roles: string[] | undefined | null): boolean {
  const allowed = new Set<string>(codesFor(module));
  return (roles ?? []).some((r) => allowed.has(r));
}

/**
 * Dynamic feature unlocking for TVET trainers.
 *
 * A plain trainer only gets the Industrial Practical Training surface once the
 * server confirms they hold an active placement assignment. Roles that own the
 * module by mandate (admin, coordinator, director, industrial DH) are never
 * gated by placement.
 */
export function isTrainerAssignedToPracticalPlacement(me: {
  roles?: string[] | null;
  isTrainerOnActivePlacement?: boolean | null;
} | null | undefined): boolean {
  return Boolean(me?.isTrainerOnActivePlacement);
}

/** Should this user see the Industrial Practical Training module at all? */
export function canEnterPracticalTraining(me: any): boolean {
  const roles: string[] = me?.roles ?? [];
  if (canAccess("ctSupervisorQueue", roles) || canAccess("ctDirectorReview", roles)) return true;
  if (me?.isIndustrialDh) return true;
  if (roles.includes("MA")) return true;
  if (roles.includes("T")) return isTrainerAssignedToPracticalPlacement(me);
  return false;
}
