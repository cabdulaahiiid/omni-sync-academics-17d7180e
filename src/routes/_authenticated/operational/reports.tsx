import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ReportShell } from "@/components/reports/report-shell";

const searchSchema = z.object({
  report: fallback(z.string(), "attendanceSummary").default("attendanceSummary"),
  group: fallback(z.string(), "Department").default("Department"),
  academic_year: z.string().optional(),
  semester_id: z.string().optional(),
  department_id: z.string().optional(),
  trainer_registry_id: z.string().optional(),
  module_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/operational/reports")({
  validateSearch: zodValidator(searchSchema),
  component: OperationalReports,
});

function OperationalReports() {
  const search = Route.useSearch();
  return <ReportShell search={search} scope="operational" />;
}