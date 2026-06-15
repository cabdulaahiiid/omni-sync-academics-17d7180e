import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runReport, type ReportResult } from "@/lib/reports.functions";

const searchSchema = z.object({
  report: fallback(z.string(), "").default(""),
  group: z.string().optional(),
  academic_year: z.string().optional(),
  semester_id: z.string().optional(),
  department_id: z.string().optional(),
  trainer_registry_id: z.string().optional(),
  module_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/print/$report")({
  validateSearch: zodValidator(searchSchema),
  component: PrintReportPage,
});

function PrintReportPage() {
  const { report } = Route.useParams();
  const search = Route.useSearch();
  const runFn = useServerFn(runReport);
  const { data, isLoading } = useQuery({
    queryKey: ["print-report", report, search],
    queryFn: () => runFn({ data: { key: report, filters: stripMeta(search) } }),
  });

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 250);
  }, [data]);

  if (isLoading || !data) {
    return <div className="p-10 text-center">Preparing report…</div>;
  }
  const r: ReportResult = data;

  return (
    <div className="mx-auto max-w-[1100px] p-8 print:p-4">
      <header className="border-b pb-4">
        <h1 className="text-lg font-semibold">Somali Regional State Jigjiga Polytechnic College</h1>
        <p className="text-sm text-muted-foreground">{r.title}</p>
        <p className="text-xs text-muted-foreground">Generated {new Date(r.generated_at).toLocaleString()}</p>
        {Object.entries(r.filters).some(([, v]) => v) && (
          <p className="mt-1 text-xs text-muted-foreground">
            Filters: {Object.entries(r.filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" · ")}
          </p>
        )}
      </header>
      {r.summary?.length ? (
        <div className="my-3 flex flex-wrap gap-3 text-sm">
          {r.summary.map((s) => (
            <span key={s.label} className="rounded border px-2 py-1">{s.label}: <b>{s.value}</b></span>
          ))}
        </div>
      ) : null}
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {r.columns.map((c) => (
              <th key={c.key} className={`px-2 py-1 text-${c.align ?? "left"} text-xs uppercase tracking-wide`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, i) => (
            <tr key={i} className="border-b">
              {r.columns.map((c) => (
                <td key={c.key} className={`px-2 py-1 text-${c.align ?? "left"}`}>{row[c.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function stripMeta(s: Record<string, string | undefined>) {
  const { report: _r, group: _g, ...rest } = s;
  void _r; void _g;
  return rest;
}
