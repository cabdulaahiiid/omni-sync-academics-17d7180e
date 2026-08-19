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
