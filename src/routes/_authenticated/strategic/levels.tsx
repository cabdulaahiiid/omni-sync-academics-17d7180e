import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLevelsByDepartment } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/levels")({
  component: LevelsPage,
});

function LevelsPage() {
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listLevelsByDepartment);
  const { data, isLoading } = useQuery({
    queryKey: ["levels-by-dept"],
    queryFn: () => list(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Levels</h1>
        <p className="text-sm text-muted-foreground">
          Levels are provisioned automatically (I–V) for every department.
        </p>
      </div>
      <Card className="bg-muted/40">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            When you create a new department, the system auto-generates 5 academic levels
            (I, II, III, IV, V). No manual setup needed.
          </span>
        </CardContent>
      </Card>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{d.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {d.levels.length === 0 ? (
                <span className="text-sm text-muted-foreground">No levels.</span>
              ) : (
                d.levels.map((l) => (
                  <Badge key={l.id} variant="secondary">Level {l.name}</Badge>
                ))
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No departments yet. Create one in the Departments tab.</p>
        )}
      </div>
    </div>
  );
}