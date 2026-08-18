import { createFileRoute } from "@tanstack/react-router";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { supervisionGap } from "@/lib/ct/workspace-model";
import { Badge } from "@/components/ui/badge";

function SupervisionPage() {
  const w = useCtWorkspace();
  const gaps = w.placements.filter((p: any) => supervisionGap(w.visitsByPlacement.get(String(p.id)) ?? [], p).overdue);

  return (
    <div className="space-y-4">
      <WorkspaceCard
        title="Supervision coverage"
        description="Recorded visits per placement, with the placements that have no recent visit highlighted."
      >
        {w.query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading supervision visits…</p>
        ) : w.placements.length === 0 ? (
          <EmptyState title="No placements to supervise" description="Supervision starts once trainees are placed." />
        ) : (
          <DataTable head={["Trainee", "Enterprise", "Visits", "Last visit", "Coverage"]}>
            {w.placements.map((p: any) => {
              const visits = w.visitsByPlacement.get(String(p.id)) ?? [];
              const gap = supervisionGap(visits, p);
              const student = w.students.get(String(p.student_id));
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-2">{student?.full_name ?? "—"}</td>
                  <td className="p-2">{w.enterprises.get(String(p.enterprise_id))?.name ?? "—"}</td>
                  <td className="p-2">{gap.visits}</td>
                  <td className="p-2 text-xs text-muted-foreground">{gap.lastVisit ?? "Never"}</td>
                  <td className="p-2">
                    <Badge variant={gap.overdue ? "destructive" : "secondary"}>{gap.overdue ? "Visit overdue" : "Up to date"}</Badge>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Recorded visits" description="Findings and actions captured by the visiting trainer during each supervision visit.">
        {(w.data?.visits ?? []).length === 0 ? (
          <EmptyState title="No visits recorded" description={`${gaps.length} placement(s) still need a first supervision visit.`} />
        ) : (
          <DataTable head={["Date", "Trainee", "Findings", "Actions", "On site"]}>
            {[...(w.data?.visits ?? [])]
              .sort((a: any, b: any) => String(b.visit_date).localeCompare(String(a.visit_date)))
              .map((v: any) => {
                const placement = w.placements.find((p: any) => p.id === v.placement_id);
                return (
                  <tr key={v.id} className="border-t border-border/60 align-top">
                    <td className="p-2">{v.visit_date}</td>
                    <td className="p-2">{w.students.get(String(placement?.student_id))?.full_name ?? "—"}</td>
                    <td className="p-2 text-xs">{v.findings ?? "—"}</td>
                    <td className="p-2 text-xs">{v.actions ?? "—"}</td>
                    <td className="p-2">
                      <Badge variant={v.geo_verified ? "secondary" : "outline"}>{v.geo_verified ? "Verified" : "Unverified"}</Badge>
                    </td>
                  </tr>
                );
              })}
          </DataTable>
        )}
      </WorkspaceCard>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/supervision")({
  head: () => ({
    meta: [
      { title: "Supervision Visits | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Track industrial supervision visits, findings, corrective actions and placements with no recent visit." },
      { property: "og:title", content: "Supervision Visits" },
      { property: "og:description", content: "Supervision coverage, findings and corrective actions for industrial placements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupervisionPage,
});
