import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getMasterData } from "@/lib/master-data.functions";
import { MASTER_DATA_KEY } from "@/lib/master-data";
import { useAuthSession } from "@/hooks/use-auth-session";

export type MasterData = Awaited<ReturnType<typeof getMasterData>>;

const EMPTY: MasterData = {
  departments: [], levels: [], sections: [], modules: [],
  trainers: [], venues: [], semesters: [], trainerLinks: [],
} as unknown as MasterData;

/** Live master data shared by every form. Options always reflect the database. */
export function useMasterData(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  const { authReady, hasSession } = useAuthSession();
  const fn = useServerFn(getMasterData);
  const q = useQuery({
    queryKey: MASTER_DATA_KEY,
    queryFn: () => fn(),
    enabled: authReady && hasSession,
    staleTime: 30_000,
    throwOnError: false,
  });
  const data = q.data ?? EMPTY;

  return useMemo(() => {
    const departments = activeOnly
      ? data.departments.filter((d: any) => d.status !== "SUSPENDED")
      : data.departments;
    const levels = activeOnly
      ? data.levels.filter((l: any) => l.status !== "SUSPENDED")
      : data.levels;
    const modules = activeOnly
      ? data.modules.filter((m: any) => m.status !== "INACTIVE")
      : data.modules;
    const trainers = activeOnly
      ? data.trainers.filter((t: any) => t.status !== "SUSPENDED")
      : data.trainers;

    return {
      ...q,
      raw: data,
      departments,
      levels,
      sections: data.sections,
      modules,
      trainers,
      venues: data.venues,
      semesters: data.semesters,
      /** Levels belonging to a department. */
      levelsFor: (departmentId?: string | null) =>
        departmentId ? levels.filter((l: any) => l.department_id === departmentId) : [],
      /** Sections belonging to a level (optionally scoped to a department). */
      sectionsFor: (levelId?: string | null, departmentId?: string | null) =>
        levelId
          ? data.sections.filter(
              (s: any) =>
                s.level_id === levelId && (!departmentId || s.department_id === departmentId),
            )
          : [],
      /** Modules for a department, optionally narrowed to a level. */
      modulesFor: (departmentId?: string | null, levelId?: string | null) =>
        modules.filter(
          (m: any) =>
            (!departmentId || m.department_id === departmentId) &&
            (!levelId || m.level_id === levelId),
        ),
      /** Trainers of a department, including multi-department assignments. */
      trainersFor: (departmentId?: string | null) => {
        if (!departmentId) return trainers;
        const linked = new Set(
          data.trainerLinks
            .filter((l: any) => l.department_id === departmentId)
            .map((l: any) => l.trainer_registry_id as string),
        );
        return trainers.filter(
          (t: any) => t.department_id === departmentId || linked.has(t.id),
        );
      },
      labelForLevel: (l: any) => (l?.display_name || l?.name || "—") as string,
    };
  }, [data, activeOnly, q]);
}

/** Call after any admin master-data mutation so every dropdown refreshes. */
export function useInvalidateMasterData() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: MASTER_DATA_KEY });
}