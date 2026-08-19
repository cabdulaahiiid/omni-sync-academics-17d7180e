import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCoordinatorSummary } from "@/lib/ct/coordinator.functions";
import { useMe } from "@/hooks/use-me";
import { AppShell } from "@/components/erp/app-shell";
import { operationalNavFor } from "@/components/erp/operational-nav";
import { NavHeader } from "@/components/erp/nav-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/erp/empty-state";
import { StatusBadge } from "@/components/erp/status-badge";
import { canAccess } from "@/lib/auth/role-matrix";
import { ShieldAlert } from "lucide-react";

function CoordinatorDashboard() {
  const { data: me } = useMe();
  const fn = useServerFn(getCoordinatorSummary);
  const roles = (me?.roles ?? []) as string[];
  const allowed = canAccess("coordinatorDashboard", roles);

  const summary = useQuery({
    queryKey: ["coordinator", "summary"],
    queryFn: () => fn(),
    enabled: allowed,
    staleTime: 15_000,
  });

  const data = summary.data;

  return (
    <AppShell nav={operationalNavFor(me)}>
      <NavHeader
        title="Industrial Training Coordinator Hub"
        description="Department Head practical training requests across the college, with ageing and per-department load."
      />
      {!allowed ? (
        <EmptyState icon={ShieldAlert} title="Not available for your role" description="Only coordinators, program directors, department heads and administrators can open this hub." />
      ) : (
        <div className="space-y-4">
          {data && !data.cross_department && (
            <p className="rounded-lg border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
              You are viewing your own department only. Cross-department totals are reserved for coordinators and directors.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(data?.by_status ?? []).map((s) => (
              <Card key={s.status}>
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.status.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{s.total}</p>
                </CardContent>
              </Card>
            ))}
            {summary.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">By department</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.by_department ?? []).length === 0 && <EmptyState title="No requests yet" />}
              {(data?.by_department ?? []).map((d) => (
                <div key={d.department_id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-sm">{d.department_name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{d.open_total} open</Badge>
                    {d.total} total
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Oldest pending requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data?.oldest_pending ?? []).length === 0 && <EmptyState title="Nothing waiting" description="Every submitted request has been decided." />}
              {(data?.oldest_pending ?? []).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.title ?? r.reference ?? "Request"}</p>
                    <p className="text-[11px] text-muted-foreground">{r.department_name} · waiting {r.age_days} day(s)</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated/coordinator/dashboard")({
  head: () => ({
    meta: [
      { title: "Coordinator Hub | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Cross-department view of industrial practical training requests, ageing and department load for training coordinators." },
      { property: "og:title", content: "Industrial Training Coordinator Hub" },
      { property: "og:description", content: "Aggregated Department Head practical training requests with strict department isolation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoordinatorDashboard,
});
