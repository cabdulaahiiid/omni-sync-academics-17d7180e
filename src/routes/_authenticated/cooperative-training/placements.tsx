import { createFileRoute } from "@tanstack/react-router";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { TrainerPicker } from "@/components/ct/trainer-picker";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { StatusBadge } from "@/components/erp/status-badge";
import { Badge } from "@/components/ui/badge";

function PlacementsPage() {
  const w = useCtWorkspace();
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
                  <TrainerPicker
                    placementId={String(p.id)}
                    departmentId={p.department_id}
                    value={p.visiting_trainer_id}
                    disabled={Boolean(p.locked)}
                  />
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
