import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { evaluationOutcome, summariseLogbook, supervisionGap } from "@/lib/ct/workspace-model";
import { downloadCsv, downloadPdf } from "@/lib/report-export";
import type { ReportResult } from "@/lib/reports.functions";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ReportKey = "placements" | "logbooks" | "supervision" | "competency";

const TITLES: Record<ReportKey, string> = {
  placements: "Industrial placement register",
  logbooks: "Logbook compliance",
  supervision: "Supervision coverage",
  competency: "Competency outcomes",
};

function ReportsPage() {
  const w = useCtWorkspace();
  const me = useMe();
  const [key, setKey] = useState<ReportKey>("placements");

  const report: ReportResult = useMemo(() => {
    const rows = w.placements.map((p: any) => {
      const student = w.students.get(String(p.student_id));
      const entries = w.logbooksByPlacement.get(String(p.id)) ?? [];
      const log = summariseLogbook(entries, p);
      const gap = supervisionGap(w.visitsByPlacement.get(String(p.id)) ?? [], p);
      const out = evaluationOutcome(w.evaluationsByPlacement.get(String(p.id)) ?? []);
      const base = {
        trainee: student?.full_name ?? "—",
        registration_number: student?.registration_number ?? "—",
        enterprise: w.enterprises.get(String(p.enterprise_id))?.name ?? "—",
      };
      if (key === "placements") {
        return {
          ...base,
          site: w.sites.get(String(p.training_site_id))?.name ?? "—",
          mentor: w.mentors.get(String(p.mentor_contact_id))?.full_name ?? "—",
          start_date: p.start_date,
          end_date: p.end_date,
          status: p.status,
        };
      }
      if (key === "logbooks") {
        return {
          ...base,
          entries: log.total,
          approved: log.approved,
          hours: log.hours,
          missing_days: log.missingDays,
          compliance: `${log.compliance}%`,
        };
      }
      if (key === "supervision") {
        return { ...base, visits: gap.visits, last_visit: gap.lastVisit ?? "Never", coverage: gap.overdue ? "Overdue" : "Up to date" };
      }
      return {
        ...base,
        evaluations: out.count,
        finalized: out.finalized,
        failed_ucs: out.failedUc,
        red_competencies: out.redCompetencies,
        recommendation: out.recommendation ?? "Not evaluated",
      };
    });
    const columns = Object.keys(rows[0] ?? { trainee: "" }).map((k) => ({
      key: k,
      label: k.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
    }));
    return {
      key: `ct_${key}`,
      title: TITLES[key],
      columns: columns as ReportResult["columns"],
      rows: rows as ReportResult["rows"],
      summary: [{ label: "Placements", value: rows.length }],
      generated_at: new Date().toISOString(),
      filters: {},
    };
  }, [key, w.placements, w.students, w.enterprises, w.sites, w.mentors, w.logbooksByPlacement, w.visitsByPlacement, w.evaluationsByPlacement]);

  const ctx = {
    userName: me.data?.profile?.full_name ?? me.data?.profile?.email ?? null,
    userRole: me.data?.roles?.[0] ?? null,
  };

  async function exportPdf() {
    try { await downloadPdf(report, ctx); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <WorkspaceCard title="Practical training reports" description="Placement, logbook, supervision and competency summaries for the trainees in your scope.">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={key} onValueChange={(v) => setKey(v as ReportKey)}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TITLES) as ReportKey[]).map((k) => (
              <SelectItem key={k} value={k}>{TITLES[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={report.rows.length === 0} onClick={() => downloadCsv(report)}>Export CSV</Button>
        <Button size="sm" disabled={report.rows.length === 0} onClick={exportPdf}>Export PDF</Button>
      </div>

      {w.query.isLoading ? (
        <p className="text-sm text-muted-foreground">Preparing the report…</p>
      ) : report.rows.length === 0 ? (
        <EmptyState title="No data yet" description="Reports fill up once placements, logbooks and evaluations exist." />
      ) : (
        <DataTable head={report.columns.map((c) => c.label)}>
          {report.rows.map((row: any, i: number) => (
            <tr key={i} className="border-t border-border/60">
              {report.columns.map((c) => (
                <td key={c.key} className="p-2">{String(row[c.key] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </DataTable>
      )}
    </WorkspaceCard>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/reports")({
  head: () => ({
    meta: [
      { title: "Practical Training Reports | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Placement, logbook compliance, supervision coverage and competency outcome reports for industrial practical training." },
      { property: "og:title", content: "Practical Training Reports" },
      { property: "og:description", content: "Export placement, logbook, supervision and competency reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
