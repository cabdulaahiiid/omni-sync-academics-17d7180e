import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyStudents } from "@/lib/students.functions";
import { listDepartments } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiTile } from "@/components/erp/kpi-tile";
import { EmptyState } from "@/components/erp/empty-state";
import { Users, Building2, GraduationCap, Layers, Search, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/students")({
  component: StudentsDirectoryPage,
});

const PAGE_SIZE = 25;

function StudentsDirectoryPage() {
  const listFn = useServerFn(listMyStudents);
  const deptsFn = useServerFn(listDepartments);
  const { data: students, isLoading } = useQuery({
    queryKey: ["ma-students-directory"],
    queryFn: () => listFn(),
  });
  const { data: depts } = useQuery({ queryKey: ["departments"], queryFn: () => deptsFn() });

  const deptMap = useMemo(
    () => Object.fromEntries((depts ?? []).map((d: any) => [d.id, d.name])),
    [depts],
  );

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [section, setSection] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const levelOptions = useMemo(() => {
    const set = new Map<string, string>();
    (students ?? []).forEach((s: any) => { if (s.level_name) set.set(s.level_name, s.level_name); });
    return Array.from(set.values()).sort();
  }, [students]);

  const sectionOptions = useMemo(() => {
    const set = new Map<string, string>();
    (students ?? []).forEach((s: any) => { if (s.section_name) set.set(s.section_name, s.section_name); });
    return Array.from(set.values()).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students ?? []).filter((s: any) => {
      if (q && !`${s.full_name ?? ""} ${s.registration_number ?? ""}`.toLowerCase().includes(q)) return false;
      if (dept !== "all" && s.department_id !== dept) return false;
      if (level !== "all" && s.level_name !== level) return false;
      if (section !== "all" && s.section_name !== section) return false;
      if (status !== "all" && (s.status ?? "active") !== status) return false;
      return true;
    });
  }, [students, search, dept, level, section, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const kpis = useMemo(() => {
    const list = students ?? [];
    const deptsCount = new Set(list.map((s: any) => s.department_id).filter(Boolean)).size;
    const levelsCount = new Set(list.map((s: any) => s.level_name).filter((v: any) => v && v !== "—")).size;
    const sectionsCount = new Set(list.map((s: any) => s.section_name).filter((v: any) => v && v !== "—")).size;
    return { total: list.length, depts: deptsCount, levels: levelsCount, sections: sectionsCount };
  }, [students]);

  function resetFilters() {
    setSearch(""); setDept("all"); setLevel("all"); setSection("all"); setStatus("all"); setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Students Directory</h1>
        <p className="text-sm text-muted-foreground">Institution-wide roster across every department, level and section.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Total Students" value={kpis.total} icon={Users} tone="blue" />
        <KpiTile label="Departments" value={kpis.depts} icon={Building2} tone="purple" />
        <KpiTile label="Levels" value={kpis.levels} icon={GraduationCap} tone="green" />
        <KpiTile label="Sections" value={kpis.sections} icon={Layers} tone="orange" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or registration #"
                className="pl-8"
              />
            </div>
            <Select value={dept} onValueChange={(v) => { setDept(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {(depts ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={(v) => { setLevel(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {levelOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={section} onValueChange={(v) => { setSection(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sectionOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length.toLocaleString()} result{filtered.length === 1 ? "" : "s"}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Students</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No students match these filters"
                description="Try clearing filters or searching by a different name or registration number."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Reg #</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((s: any) => {
                    const st = (s.status ?? "active").toLowerCase();
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.registration_number}</TableCell>
                        <TableCell className="font-medium">{s.full_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{deptMap[s.department_id] ?? "—"}</TableCell>
                        <TableCell className="text-sm">{s.level_name}</TableCell>
                        <TableCell className="text-sm">{s.section_name}</TableCell>
                        <TableCell>
                          <Badge variant={st === "active" ? "default" : "secondary"} className="capitalize">{st}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
                <span>Page {safePage} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}