import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCtGapAnalytics } from "@/lib/ct/gap-analytics.functions";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { Badge } from "@/components/ui/badge";

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  HIGH: "destructive",
  MEDIUM: "secondary",
  LOW: "outline",
};

function GapsPage() {
  const load = useServerFn(listCtGapAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["ct", "gap-analytics"], queryFn: () => load() });
  const departments = new Map<string, string>((data?.departments ?? []).map((d: any) => [d.id, d.name]));
  const gaps = data?.gaps ?? [];
  const max = gaps[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <WorkspaceCard
        title="Recurring skill gaps"
        description="Aggregated from the gap tags industry trainers record in daily logs and from units not yet competent — use it to adjust the curriculum."
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading skill gap analytics…</p>
        ) : gaps.length === 0 ? (
          <EmptyState title="No skill gaps recorded" description="Gaps appear once industry trainers tag them in daily logs or evaluations are finalized." />
        ) : (
          <DataTable head={["Skill gap", "Department", "Occurrences", "Trainees affected", "Severity", "Share"]}>
            {gaps.map((g: any) => (
              <tr key={`${g.department_id}-${g.tag}`} className="border-t border-border/60">
                <td className="p-2 font-medium">{g.tag}</td>
                <td className="p-2 text-xs text-muted-foreground">{departments.get(String(g.department_id)) ?? "—"}</td>
                <td className="p-2">{g.count}</td>
                <td className="p-2">{g.trainees}</td>
                <td className="p-2"><Badge variant={SEVERITY_VARIANT[g.severity] ?? "secondary"}>{g.severity}</Badge></td>
                <td className="p-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((g.count / max) * 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </WorkspaceCard>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/gaps")({
  head: () => ({
    meta: [
      { title: "Skill Gap Analytics | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Recurring practical skill gaps per department, aggregated from industry daily logs and final evaluations." },
      { property: "og:title", content: "Department Skill Gap Analytics" },
      { property: "og:description", content: "Spot recurring training deficits and adjust the curriculum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GapsPage,
});
