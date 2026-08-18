import { createFileRoute } from "@tanstack/react-router";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { evaluationOutcome } from "@/lib/ct/workspace-model";
import { Badge } from "@/components/ui/badge";

function EvaluationPage() {
  const w = useCtWorkspace();
  const ready = w.placements.filter((p: any) =>
    evaluationOutcome(w.evaluationsByPlacement.get(String(p.id)) ?? []).readyForAssessment,
  );

  return (
    <div className="space-y-4">
      <WorkspaceCard
        title="Competency evaluation"
        description="Trainer and mentor evaluations with failed units of competence, red competencies and the resulting recommendation."
      >
        {w.query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading evaluations…</p>
        ) : w.placements.length === 0 ? (
          <EmptyState title="Nothing to evaluate" description="Evaluations appear once placements are under way." />
        ) : (
          <DataTable head={["Trainee", "Evaluations", "Failed UCs", "Red competencies", "Recommendation"]}>
            {w.placements.map((p: any) => {
              const out = evaluationOutcome(w.evaluationsByPlacement.get(String(p.id)) ?? []);
              const student = w.students.get(String(p.student_id));
              return (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="p-2">
                    <p className="font-medium">{student?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{student?.registration_number ?? ""}</p>
                  </td>
                  <td className="p-2 text-xs">{out.count} recorded · {out.finalized} finalised</td>
                  <td className="p-2">{out.failedUc}</td>
                  <td className="p-2">{out.redCompetencies}</td>
                  <td className="p-2">
                    {out.recommendation ? (
                      <Badge variant={out.readyForAssessment ? "secondary" : "outline"}>
                        {out.recommendation.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not evaluated</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </WorkspaceCard>

      <WorkspaceCard title="Ready for assessment" description="Trainees whose finalised evaluation recommends national competency assessment.">
        {ready.length === 0 ? (
          <EmptyState title="No trainee is ready yet" description="A finalised evaluation with a READY FOR ASSESSMENT recommendation moves a trainee here." />
        ) : (
          <ul className="space-y-1 text-sm">
            {ready.map((p: any) => (
              <li key={p.id} className="rounded-md border border-border/60 px-3 py-2">
                {w.students.get(String(p.student_id))?.full_name ?? "—"} ·{" "}
                <span className="text-xs text-muted-foreground">{w.enterprises.get(String(p.enterprise_id))?.name ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </WorkspaceCard>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/evaluation")({
  head: () => ({
    meta: [
      { title: "Competency Evaluation | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Review trainer and mentor competency evaluations and see which trainees are ready for assessment." },
      { property: "og:title", content: "Competency Evaluation" },
      { property: "og:description", content: "Competency ratings, failed units and assessment readiness for industrial trainees." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvaluationPage,
});
