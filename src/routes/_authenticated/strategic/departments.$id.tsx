import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDepartmentOverview } from "@/lib/approvals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Users, Layers, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/departments/$id")({
  component: DepartmentDetailPage,
});

function DepartmentDetailPage() {
  const { id } = Route.useParams();
  const overviewFn = useServerFn(getDepartmentOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["dept-overview", id],
    queryFn: () => overviewFn({ data: { department_id: id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.department) return <p className="text-sm text-muted-foreground">Department not found.</p>;

  const d = data.department as { name: string; description: string | null; status: string };
  const sectionRowCount = Object.values(data.sectionsByLevel).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="space-y-6">
      <Link to="/strategic/departments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to departments
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
          {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
        </div>
        <Badge variant={d.status === "ACTIVE" ? "default" : "secondary"}>{d.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Layers className="h-4 w-4" />} label="Levels" value={data.levels.length} />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Sections" value={sectionRowCount} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Trainers" value={data.trainers.length} />
        <StatCard icon={<BookOpen className="h-4 w-4" />} label="Modules" value={data.moduleStats.total} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Module progress</CardTitle></CardHeader>
          <CardContent className="flex gap-4 text-sm">
            <span><Activity className="mr-1 inline h-3.5 w-3.5 text-emerald" />Completed: <b>{data.moduleStats.completed}</b></span>
            <span><Activity className="mr-1 inline h-3.5 w-3.5 text-amber" />Ongoing: <b>{data.moduleStats.ongoing}</b></span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">Levels & Sections</TabsTrigger>
          <TabsTrigger value="trainers">Trainers</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-3">
          {data.levels.length === 0 && <p className="text-sm text-muted-foreground">No levels configured.</p>}
          {data.levels.map((lvl: any) => {
            const secs = data.sectionsByLevel[lvl.id] ?? [];
            return (
              <Card key={lvl.id}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">
                    {lvl.display_name ?? `Level ${lvl.name}`}
                  </CardTitle>
                  <Badge variant={lvl.status === "ACTIVE" ? "default" : "secondary"}>{lvl.status}</Badge>
                </CardHeader>
                <CardContent>
                  {secs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No sections.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {secs.map((s) => <Badge key={s.id} variant="outline">Section {s.name}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="trainers">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Progress</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trainers.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No trainers.</TableCell></TableRow>
                )}
                {data.trainers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.email}</TableCell>
                    <TableCell>{t.sessions_completed} / {t.sessions_target}</TableCell>
                    <TableCell><Badge variant={t.status === "ACTIVE" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead>
                  <TableHead>Sessions</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modules.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No modules.</TableCell></TableRow>
                )}
                {data.modules.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.total_sessions}</TableCell>
                    <TableCell><Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}