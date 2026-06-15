import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ReportShell } from "@/components/reports/report-shell";

const searchSchema = z.object({
  report: fallback(z.string(), "institutionSummary").default("institutionSummary"),
  group: fallback(z.string(), "Admin").default("Admin"),
  academic_year: z.string().optional(),
  semester_id: z.string().optional(),
  department_id: z.string().optional(),
  trainer_registry_id: z.string().optional(),
  module_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/strategic/reports")({
  validateSearch: zodValidator(searchSchema),
  component: StrategicReports,
});

function StrategicReports() {
  const search = Route.useSearch();
  return <ReportShell search={search} scope="all" />;
}