import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { listCtDepartmentTrainers, setCtPlacementTrainer } from "@/lib/ct/trainers.functions";
import { toastError } from "@/lib/errors/toast";
import { toast } from "sonner";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { StatusBadge } from "@/components/erp/status-badge";
import { Badge } from "@/components/ui/badge";

function PlacementsPage() {
  const w = useCtWorkspace();
  const qc = useQueryClient();
  const trainersFn = useServerFn(listCtDepartmentTrainers);
  const assignFn = useServerFn(setCtPlacementTrainer);

  // One trainer pool per department represented in the placement list, so a
  // placement can only ever be assigned a trainer of its own department.
  const departmentIds = useMemo(
    () => Array.from(new Set(w.placements.map((p: any) => String(p.department_id)).filter(Boolean))),
    [w.placements],
  );
  const trainerQueries = useQueries({
    queries: departmentIds.map((id) => ({
      queryKey: ["ct", "department-trainers", id],
      queryFn: () => trainersFn({ data: { department_id: id } }),
      staleTime: 60_000,
    })),
  });
  const poolByDepartment = new Map<string, any>();
  departmentIds.forEach((id, i) => poolByDepartment.set(id, trainerQueries[i]?.data));

  async function assign(placementId: string, trainerId: string) {
    try {
      await assignFn({ data: { placement_id: placementId, trainer_registry_id: trainerId || null } });
      toast.success("Assigned trainer updated.");
      await qc.invalidateQueries({ queryKey: ["ct", "workspace"] });
      await qc.invalidateQueries({ queryKey: ["ct", "department-trainers"] });
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <WorkspaceCard
      title="Active placements"
      description="Every trainee placed with an enterprise, with mentor, dates and day-1 check-in state. You only see the placements your role is responsible for."
    >
      {w.query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading placements…</p>
      ) : w.placements.length === 0 ? (
        <EmptyState title="No placements yet" description="Placements appear once an approved request is allocated to enterprises." />
      ) : (
        <DataTable head={["Trainee", "Enterprise / site", "Mentor", "Assigned trainer", "Dates", "Day 1 check-in", "Status"]}>
          {w.placements.map((p: any) => {
            const student = w.students.get(String(p.student_id));
            const enterprise = w.enterprises.get(String(p.enterprise_id));
            const site = w.sites.get(String(p.training_site_id));
            const mentor = w.mentors.get(String(p.mentor_contact_id));
            const checkin = (w.checkinsByPlacement.get(String(p.id)) ?? [])[0];
            const pool = poolByDepartment.get(String(p.department_id));
            const trainers = (pool?.trainers ?? []) as any[];
            return (
              <tr key={p.id} className="border-t border-border/60 align-top">
                <td className="p-2">
                  <p className="font-medium">{student?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{student?.registration_number ?? ""}</p>
                </td>
                <td className="p-2">
                  <p>{enterprise?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{site?.name ?? site?.location ?? ""}</p>
                </td>
                <td className="p-2">
                  <p>{mentor?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{mentor?.phone ?? ""}</p>
                </td>
                <td className="p-2">
                  <select
                    className="h-8 w-44 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-60"
                    value={p.visiting_trainer_id ?? ""}
                    disabled={p.locked || trainers.length === 0}
                    onChange={(e) => assign(String(p.id), e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} · {t.assigned_load} trainee(s)
                      </option>
                    ))}
                  </select>
                  {trainers.length === 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">No trainers in this department yet.</p>
                  )}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{p.start_date} → {p.end_date}</td>
                <td className="p-2">
                  {checkin ? (
                    <Badge variant={checkin.geo_verified ? "secondary" : "outline"}>
                      {new Date(checkin.checked_in_at).toLocaleDateString()}
                      {checkin.geo_verified ? " · on site" : " · unverified"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not checked in</Badge>
                  )}
                </td>
                <td className="p-2"><StatusBadge status={p.status} /></td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </WorkspaceCard>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/placements")({
  head: () => ({
    meta: [
      { title: "Practical Training Placements | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Track active industrial practical training placements: trainee, enterprise, mentor, dates and day-one check-in." },
      { property: "og:title", content: "Practical Training Placements" },
      { property: "og:description", content: "Active industrial placements with enterprise, mentor and check-in status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlacementsPage,
});
