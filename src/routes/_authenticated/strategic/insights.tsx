import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardInsights } from "@/lib/ma.functions";
import { listTrainers } from "@/lib/dh.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle, CheckCircle2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const insightsFn = useServerFn(dashboardInsights);
  const trainersFn = useServerFn(listTrainers);
  const { data: kpi } = useQuery({ queryKey: ["ma-insights"], queryFn: () => insightsFn(), staleTime: 15000 });
  const { data: trainers } = useQuery({ queryKey: ["ma-trainers"], queryFn: () => trainersFn(), staleTime: 60000 });

  const cards = [
    { label: "Live Sessions", value: kpi?.live ?? 0, icon: Activity, tone: "stat-green" },
    { label: "Pending Approvals", value: kpi?.pending ?? 0, icon: AlertCircle, tone: "stat-orange" },
    { label: "Completed Sessions", value: kpi?.ended ?? 0, icon: CheckCircle2, tone: "stat-blue" },
    { label: "Active Trainers", value: kpi?.trainers ?? 0, icon: Users, tone: "stat-purple" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Institutional Insights</h1>
        <p className="text-sm text-muted-foreground">Live operational metrics across departments.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="rounded-2xl border-l-4" style={{ borderLeftColor: `hsl(var(--${c.tone}))` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4" style={{ color: `hsl(var(--${c.tone}))` }} />
            </CardHeader>
            <CardContent><p className="text-2xl font-semibold">{c.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Trainer Workload Heatmap</CardTitle></CardHeader>
        <CardContent>
          {!trainers?.length && <p className="text-sm text-muted-foreground">No trainers yet.</p>}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {(trainers ?? []).map((t: any) => {
              const load = t.qualifications?.length ?? 0;
              const tone = load >= 4 ? "destructive" : load >= 2 ? "default" : "secondary";
              return (
                <div key={t.id} className="rounded-xl border p-3 text-sm">
                  <p className="truncate font-medium">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.department_name}</p>
                  <Badge variant={tone as any} className="mt-2 text-[10px]">{load} quals</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}