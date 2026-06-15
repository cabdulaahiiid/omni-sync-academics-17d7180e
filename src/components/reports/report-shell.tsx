import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  REPORT_CATALOGUE,
  getReportFilterOptions,
  runReport,
  type ReportFilters,
  type ReportResult,
} from "@/lib/reports.functions";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ExportMenu } from "@/components/reports/export-menu";
import { useLiveTables } from "@/hooks/use-live-tables";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Search = ReportFilters & { report: string; group?: string };

export function ReportShell({
  search,
  routeFrom,
  scope = "all",
}: {
  search: Search;
  routeFrom: string;
  scope?: "all" | "operational";
}) {
  const navigate = useNavigate({ from: routeFrom });
  const qc = useQueryClient();
  const runFn = useServerFn(runReport);
  const optionsFn = useServerFn(getReportFilterOptions);

  // Tabs by group
  const groups = useMemo(() => {
    const g = Array.from(new Set(REPORT_CATALOGUE.map((r) => r.group)));
    return scope === "operational" ? g.filter((x) => x !== "Admin") : g;
  }, [scope]);
  const activeGroup = search.group ?? groups[0];
  const reportsForGroup = REPORT_CATALOGUE.filter((r) => r.group === activeGroup);
  const activeReport = REPORT_CATALOGUE.find((r) => r.key === search.report) ?? reportsForGroup[0];

  const filters: ReportFilters = {
    academic_year: search.academic_year,
    semester_id: search.semester_id,
    department_id: search.department_id,
    trainer_registry_id: search.trainer_registry_id,
    module_id: search.module_id,
    date_from: search.date_from,
    date_to: search.date_to,
    status: search.status,
  };

  useLiveTables(
    ["schedules", "approval_queue", "attendance_logs", "session_logs", "students", "trainer_registry", "modules"],
    ["report", "report-options"],
  );

  const optsQ = useQuery({
    queryKey: ["report-options"],
    queryFn: () => optionsFn(),
    staleTime: 60_000,
  });

  const reportQ = useQuery({
    queryKey: ["report", activeReport?.key, filters],
    queryFn: () => runFn({ data: { key: activeReport!.key, filters } }),
    enabled: !!activeReport,
  });

  const setSearch = (next: Partial<Search>) => {
    navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, ...next })) as never, replace: true });
  };

  const result: ReportResult | undefined = reportQ.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Live, database-derived reports. Filters persist in the URL — share or bookmark a report at any time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["report"] })}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <ExportMenu report={result} currentSearch={window.location.search} filters={filters} />
        </div>
      </div>

      <Tabs value={activeGroup} onValueChange={(g) => setSearch({ group: g, report: REPORT_CATALOGUE.find((r) => r.group === g)?.key })}>
        <TabsList>
          {groups.map((g) => <TabsTrigger key={g} value={g}>{g}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Report</span>
        <Select value={activeReport?.key} onValueChange={(k) => setSearch({ report: k })}>
          <SelectTrigger className="h-9 w-[280px]">
            <SelectValue placeholder="Pick a report" />
          </SelectTrigger>
          <SelectContent>
            {reportsForGroup.map((r) => <SelectItem key={r.key} value={r.key}>{r.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <ReportFilterBar
        value={filters}
        options={optsQ.data}
        onChange={(next) => setSearch(next)}
        onReset={() => setSearch({
          academic_year: undefined, semester_id: undefined, department_id: undefined,
          trainer_registry_id: undefined, module_id: undefined, date_from: undefined,
          date_to: undefined, status: undefined,
        })}
      />

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{result?.title ?? activeReport?.title ?? "Report"}</CardTitle>
            {result?.summary?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {result.summary.map((s) => (
                  <Badge key={s.label} variant="secondary">{s.label}: {s.value}</Badge>
                ))}
              </div>
            ) : null}
          </div>
          {result && (
            <span className="text-xs text-muted-foreground">
              Generated {new Date(result.generated_at).toLocaleString()}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {reportQ.isLoading && <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>}
          {reportQ.isError && <p className="py-12 text-center text-sm text-destructive">{(reportQ.error as Error).message}</p>}
          {result && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {result.columns.map((c) => (
                      <th
                        key={c.key}
                        className={`px-3 py-2 text-${c.align ?? "left"} font-medium`}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 && (
                    <tr>
                      <td colSpan={result.columns.length} className="py-12 text-center text-muted-foreground">
                        No matching rows for the selected filters.
                      </td>
                    </tr>
                  )}
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {result.columns.map((c) => (
                        <td key={c.key} className={`px-3 py-2 text-${c.align ?? "left"}`}>
                          {formatCell(row[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /T\d\d:\d\d/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(v);
}
