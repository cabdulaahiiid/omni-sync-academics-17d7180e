import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCtOverview } from "@/lib/ct/overview.functions";
import { CT_KEYS } from "@/lib/ct/keys";
import { KpiTile } from "@/components/erp/kpi-tile";
import { EmptyState } from "@/components/erp/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Building2, ClipboardList, FileWarning, GraduationCap, ShieldCheck } from "lucide-react";

function Overview() {
  const fn = useServerFn(getCtOverview);
  const { data, isLoading } = useQuery({ queryKey: CT_KEYS.overview, queryFn: () => fn(), staleTime: 15_000 });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Open requests" value={String(data?.requests_pending ?? 0)} icon={ClipboardList} />
        <KpiTile label="Active placements" value={String(data?.placements_active ?? 0)} icon={GraduationCap} />
        <KpiTile label="Logbook days awaiting mentor" value={String(data?.logbook_pending ?? 0)} icon={Activity} />
        <KpiTile label="Ready for assessment" value={String(data?.assessment_queue ?? 0)} icon={ShieldCheck} />
        <KpiTile label="Enterprise capacity" value={`${data?.occupied ?? 0} / ${data?.capacity ?? 0}`} icon={Building2} />
        <KpiTile label="Absence alerts" value={String(data?.absences ?? 0)} icon={FileWarning} />
        <KpiTile label="Completed placements" value={String(data?.placements_completed ?? 0)} icon={GraduationCap} />
        <KpiTile label="Total requests" value={String(data?.requests_total ?? 0)} icon={ClipboardList} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent workflow activity</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (data?.events ?? []).length === 0 ? (
            <EmptyState title="No activity yet" description="Workflow steps appear here as requests, placements and evaluations progress." />
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {(data?.events ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-medium">{e.event_type.replace(/^CT_/, "").replaceAll("_", " ").toLowerCase()}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.entity_type.replace("ct_", "").replaceAll("_", " ")} · {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/")({ component: Overview });
