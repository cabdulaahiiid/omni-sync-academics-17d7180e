import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { ReportResult, ReportFilters } from "@/lib/reports.functions";
import { downloadCsv, downloadXlsx, downloadPdf, openPrintView } from "@/lib/report-export";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const logExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      key: z.string(),
      format: z.enum(["csv", "xlsx", "pdf", "print"]),
      filters: z.record(z.string(), z.any()).default({}),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "EXPORT_REPORT",
      entity_type: "reports",
      entity_id: `${data.key}:${data.format}`,
      after_state: { filters: data.filters as Record<string, string | undefined> },
    });
    return { ok: true };
  });

export function ExportMenu({
  report,
  currentSearch,
  filters,
}: {
  report?: ReportResult;
  currentSearch: string;
  filters: ReportFilters;
}) {
  const log = useServerFn(logExport);
  const audit = useMutation({ mutationFn: (format: "csv" | "xlsx" | "pdf" | "print") =>
    log({ data: { key: report?.key ?? "unknown", format, filters: filters as unknown as Record<string, string | undefined> } }) });

  const run = async (format: "csv" | "xlsx" | "pdf" | "print") => {
    if (!report) { toast.error("Report still loading"); return; }
    try {
      if (format === "csv") downloadCsv(report);
      else if (format === "xlsx") await downloadXlsx(report);
      else if (format === "pdf") await downloadPdf(report);
      else openPrintView(report.key, currentSearch);
      audit.mutate(format);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!report}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("csv")}><FileText className="mr-2 h-4 w-4" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf")}><FileText className="mr-2 h-4 w-4" />PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("print")}><Printer className="mr-2 h-4 w-4" />Print view</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
