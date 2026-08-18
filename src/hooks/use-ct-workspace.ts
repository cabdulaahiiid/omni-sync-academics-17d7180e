import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCtWorkspace } from "@/lib/ct/monitoring.functions";
import { groupBy, indexBy } from "@/lib/ct/workspace-model";

export function useCtWorkspace() {
  const fn = useServerFn(getCtWorkspace);
  const query = useQuery({ queryKey: ["ct", "workspace"], queryFn: () => fn(), staleTime: 10_000 });
  const d = query.data;
  return {
    query,
    data: d,
    students: indexBy(d?.students ?? []),
    enterprises: indexBy(d?.enterprises ?? []),
    sites: indexBy(d?.sites ?? []),
    mentors: indexBy(d?.mentors ?? []),
    requests: indexBy(d?.requests ?? []),
    departments: indexBy(d?.departments ?? []),
    logbooksByPlacement: groupBy(d?.logbooks ?? [], "placement_id"),
    visitsByPlacement: groupBy(d?.visits ?? [], "placement_id"),
    evaluationsByPlacement: groupBy(d?.evaluations ?? [], "placement_id"),
    checkinsByPlacement: groupBy(d?.checkins ?? [], "placement_id"),
    absencesByPlacement: groupBy(d?.absences ?? [], "placement_id"),
    placements: d?.placements ?? [],
  };
}
