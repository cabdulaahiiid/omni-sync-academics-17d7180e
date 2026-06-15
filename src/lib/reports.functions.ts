import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Live reporting engine.
 * Every report below is computed directly from the current database state
 * (no caching, no static values). All reports accept the same filter shape so
 * the UI can switch between reports without changing the filter bar.
 *
 * Reports come back as { columns, rows, summary } — a tabular shape that the
 * UI, exporters (CSV/XLSX/PDF), and the print view all consume identically.
 */

export const ReportFiltersSchema = z.object({
  academic_year: z.string().optional(),
  semester_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  trainer_registry_id: z.string().uuid().optional(),
  module_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  status: z.string().optional(),
});
export type ReportFilters = z.infer<typeof ReportFiltersSchema>;

export type ReportColumn = { key: string; label: string; align?: "left" | "right" | "center" };
export type ReportCell = string | number | boolean | null;
export type ReportRow = Record<string, ReportCell>;
export type ReportResult = {
  key: string;
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  summary?: { label: string; value: string | number }[];
  generated_at: string;
  filters: ReportFilters;
};

function defaultRange(f: ReportFilters): { from: string; to: string } {
  const to = f.date_to ?? new Date().toISOString().slice(0, 10);
  const from = f.date_from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}
function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 100) : 0; }

async function logRun(supabase: any, userId: string, key: string, filters: ReportFilters) {
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action_type: "RUN_REPORT",
    entity_type: "reports",
    entity_id: key,
    after_state: filters as unknown as Record<string, string | undefined>,
  });
}

/* ------------------------------------------------------------------ */
/*  Report catalogue (metadata only — used to render the picker)      */
/* ------------------------------------------------------------------ */

export type ReportMeta = { key: string; title: string; group: "Academic" | "Department" | "Admin" | "Approvals" };
export const REPORT_CATALOGUE: ReportMeta[] = [
  // Academic
  { key: "enrollment", title: "Student enrollment", group: "Academic" },
  { key: "attendanceSummary", title: "Attendance summary", group: "Academic" },
  { key: "trainerWorkload", title: "Trainer workload", group: "Academic" },
  { key: "timetableUtilization", title: "Timetable utilization", group: "Academic" },
  { key: "semesterProgress", title: "Semester progress", group: "Academic" },
  // Department
  { key: "departmentPerformance", title: "Department performance", group: "Department" },
  { key: "trainerPerformance", title: "Trainer performance", group: "Department" },
  { key: "attendanceCompliance", title: "Attendance compliance", group: "Department" },
  { key: "activeSessions", title: "Active sessions", group: "Department" },
  // Admin
  { key: "institutionSummary", title: "Institution summary", group: "Admin" },
  { key: "userActivity", title: "User & audit activity", group: "Admin" },
  { key: "complianceSummary", title: "Compliance summary", group: "Admin" },
  // Approvals
  { key: "approvalReport", title: "Approval report", group: "Approvals" },
];

/* ------------------------------------------------------------------ */
/*  Single dispatcher server fn                                       */
/* ------------------------------------------------------------------ */

const RunSchema = z.object({
  key: z.string().min(1).max(80),
  filters: ReportFiltersSchema.default({}),
});

export const runReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunSchema.parse(d))
  .handler(async ({ data, context }): Promise<ReportResult> => {
    const { supabase, userId } = context;
    const filters = data.filters;
    const range = defaultRange(filters);

    const result = (await dispatch(supabase, data.key, filters, range)) ?? {
      title: "Unknown report",
      columns: [],
      rows: [],
      summary: [],
    };

    // Best-effort audit; do not fail the call if it can't write
    try { await logRun(supabase, userId, data.key, filters); } catch { /* ignore */ }

    return {
      key: data.key,
      title: result.title,
      columns: result.columns,
      rows: result.rows,
      summary: result.summary,
      filters,
      generated_at: new Date().toISOString(),
    };
  });

async function dispatch(
  supabase: any,
  key: string,
  f: ReportFilters,
  range: { from: string; to: string },
): Promise<{ title: string; columns: ReportColumn[]; rows: ReportRow[]; summary?: { label: string; value: string | number }[] } | null> {
  switch (key) {
    case "enrollment": return enrollment(supabase, f);
    case "attendanceSummary": return attendanceSummary(supabase, f, range);
    case "trainerWorkload": return trainerWorkload(supabase, f, range);
    case "timetableUtilization": return timetableUtilization(supabase, f, range);
    case "semesterProgress": return semesterProgress(supabase, f);
    case "departmentPerformance": return departmentPerformance(supabase, f, range);
    case "trainerPerformance": return trainerPerformance(supabase, f, range);
    case "attendanceCompliance": return attendanceCompliance(supabase, f, range);
    case "activeSessions": return activeSessions(supabase, f);
    case "institutionSummary": return institutionSummary(supabase, f, range);
    case "userActivity": return userActivity(supabase, f, range);
    case "complianceSummary": return complianceSummary(supabase, f, range);
    case "approvalReport": return approvalReport(supabase, f, range);
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function applyDeptFilter<T extends { eq: (c: string, v: string) => T }>(q: T, deptId?: string, col = "department_id"): T {
  return deptId ? q.eq(col, deptId) : q;
}

/* ------------------------------------------------------------------ */
/*  Academic                                                           */
/* ------------------------------------------------------------------ */

async function enrollment(supabase: any, f: ReportFilters) {
  let q = supabase.from("students").select("id, gender, department_id, level_id, status").limit(20000);
  q = applyDeptFilter(q, f.department_id);
  if (f.status) q = q.eq("status", f.status);
  const [{ data: students }, { data: depts }, { data: levels }] = await Promise.all([
    q,
    supabase.from("departments").select("id, name"),
    supabase.from("levels").select("id, name, department_id"),
  ]);
  const dMap = new Map((depts ?? []).map((d: any) => [d.id, d.name]));
  const lMap = new Map((levels ?? []).map((l: any) => [l.id, l.name]));
  type Row = { department: string; level: string; total: number; male: number; female: number; active: number };
  const buckets = new Map<string, Row>();
  for (const s of students ?? []) {
    const k = `${s.department_id}|${s.level_id}`;
    const b = buckets.get(k) ?? {
      department: (dMap.get(s.department_id) as string) ?? "—",
      level: (lMap.get(s.level_id) as string) ?? "—",
      total: 0, male: 0, female: 0, active: 0,
    };
    b.total++;
    const g = String(s.gender ?? "").toLowerCase();
    if (g.startsWith("m")) b.male++;
    if (g.startsWith("f")) b.female++;
    if (s.status === "ACTIVE") b.active++;
    buckets.set(k, b);
  }
  const rows = Array.from(buckets.values()).sort((a, b) => a.department.localeCompare(b.department) || a.level.localeCompare(b.level));
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return {
    title: "Student enrollment",
    columns: [
      { key: "department", label: "Department" },
      { key: "level", label: "Level" },
      { key: "total", label: "Total", align: "right" as const },
      { key: "male", label: "Male", align: "right" as const },
      { key: "female", label: "Female", align: "right" as const },
      { key: "active", label: "Active", align: "right" as const },
    ],
    rows,
    summary: [
      { label: "Total students", value: total },
      { label: "Departments", value: new Set(rows.map((r) => r.department)).size },
    ],
  };
}

async function attendanceSummary(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let scheds = supabase.from("schedules")
    .select("id, department_id, module_code, module_name, trainer_name, date")
    .gte("date", range.from).lte("date", range.to).limit(10000);
  scheds = applyDeptFilter(scheds, f.department_id);
  if (f.module_id) scheds = scheds.eq("module_id", f.module_id);
  if (f.trainer_registry_id) scheds = scheds.eq("trainer_registry_id", f.trainer_registry_id);
  if (f.semester_id) scheds = scheds.eq("semester_id", f.semester_id);
  const { data: schedules } = await scheds;
  const ids = (schedules ?? []).map((s: any) => s.id);
  const { data: atts } = ids.length
    ? await supabase.from("attendance_logs").select("schedule_id, present").in("schedule_id", ids)
    : { data: [] };
  const byDept = new Map<string, { total: number; present: number }>();
  const schedByDept = new Map<string, number>();
  const schedById = new Map((schedules ?? []).map((s: any) => [s.id, s]));
  for (const s of schedules ?? []) {
    schedByDept.set(s.department_id, (schedByDept.get(s.department_id) ?? 0) + 1);
  }
  for (const a of atts ?? []) {
    const s = schedById.get(a.schedule_id) as any;
    if (!s) continue;
    const b = byDept.get(s.department_id) ?? { total: 0, present: 0 };
    b.total++;
    if (a.present) b.present++;
    byDept.set(s.department_id, b);
  }
  const { data: depts } = await supabase.from("departments").select("id, name");
  const dMap = new Map((depts ?? []).map((d: any) => [d.id, d.name]));
  const rows = Array.from(byDept.entries()).map(([id, v]) => ({
    department: (dMap.get(id) as string) ?? "—",
    sessions: schedByDept.get(id) ?? 0,
    records: v.total,
    present: v.present,
    rate_pct: pct(v.present, v.total),
  })).sort((a, b) => b.rate_pct - a.rate_pct);
  const totalAtt = rows.reduce((acc, r) => acc + r.records, 0);
  const totalPres = rows.reduce((acc, r) => acc + r.present, 0);
  return {
    title: `Attendance summary ${range.from} → ${range.to}`,
    columns: [
      { key: "department", label: "Department" },
      { key: "sessions", label: "Sessions", align: "right" as const },
      { key: "records", label: "Records", align: "right" as const },
      { key: "present", label: "Present", align: "right" as const },
      { key: "rate_pct", label: "Rate %", align: "right" as const },
    ],
    rows,
    summary: [
      { label: "Sessions", value: (schedules ?? []).length },
      { label: "Records", value: totalAtt },
      { label: "Attendance rate", value: `${pct(totalPres, totalAtt)}%` },
    ],
  };
}

async function trainerWorkload(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let q = supabase.from("schedules")
    .select("id, trainer_registry_id, trainer_name, status, department_id, date")
    .gte("date", range.from).lte("date", range.to).limit(20000);
  q = applyDeptFilter(q, f.department_id);
  if (f.trainer_registry_id) q = q.eq("trainer_registry_id", f.trainer_registry_id);
  const { data: rows } = await q;
  const byTrainer = new Map<string, { name: string; total: number; completed: number; live: number }>();
  for (const r of rows ?? []) {
    const k = r.trainer_registry_id ?? "—";
    const b = byTrainer.get(k) ?? { name: r.trainer_name ?? "—", total: 0, completed: 0, live: 0 };
    b.total++;
    if (r.status === "ENDED") b.completed++;
    if (r.status === "ACTIVE" || r.status === "LIVE") b.live++;
    byTrainer.set(k, b);
  }
  const out = Array.from(byTrainer.values())
    .map((b) => ({ trainer: b.name, total: b.total, completed: b.completed, live: b.live, completion_pct: pct(b.completed, b.total) }))
    .sort((a, b) => b.total - a.total);
  return {
    title: `Trainer workload ${range.from} → ${range.to}`,
    columns: [
      { key: "trainer", label: "Trainer" },
      { key: "total", label: "Scheduled", align: "right" as const },
      { key: "completed", label: "Completed", align: "right" as const },
      { key: "live", label: "Live", align: "right" as const },
      { key: "completion_pct", label: "Completion %", align: "right" as const },
    ],
    rows: out,
    summary: [{ label: "Trainers", value: out.length }, { label: "Sessions", value: (rows ?? []).length }],
  };
}

async function timetableUtilization(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let q = supabase.from("schedules")
    .select("id, venue_id, status, date, start_time, end_time")
    .gte("date", range.from).lte("date", range.to).limit(20000);
  q = applyDeptFilter(q, f.department_id);
  const [{ data: rows }, { data: venues }] = await Promise.all([
    q,
    supabase.from("venues").select("id, name"),
  ]);
  const vMap = new Map((venues ?? []).map((v: any) => [v.id, v.name]));
  const buckets = new Map<string, { venue: string; sessions: number; completed: number }>();
  for (const r of rows ?? []) {
    const k = r.venue_id ?? "—";
    const b = buckets.get(k) ?? { venue: (vMap.get(k) as string) ?? "—", sessions: 0, completed: 0 };
    b.sessions++;
    if (r.status === "ENDED") b.completed++;
    buckets.set(k, b);
  }
  const out = Array.from(buckets.values())
    .map((b) => ({ ...b, utilization_pct: pct(b.completed, b.sessions) }))
    .sort((a, b) => b.sessions - a.sessions);
  return {
    title: `Timetable utilization ${range.from} → ${range.to}`,
    columns: [
      { key: "venue", label: "Venue" },
      { key: "sessions", label: "Sessions", align: "right" as const },
      { key: "completed", label: "Completed", align: "right" as const },
      { key: "utilization_pct", label: "Utilization %", align: "right" as const },
    ],
    rows: out,
    summary: [{ label: "Venues used", value: out.length }],
  };
}

async function semesterProgress(supabase: any, f: ReportFilters) {
  let q = supabase.from("semester_registry").select("id, name, status, start_date, end_date, distribution_status").order("start_date", { ascending: false });
  if (f.semester_id) q = q.eq("id", f.semester_id);
  const { data: sems } = await q;
  const semIds = (sems ?? []).map((s: any) => s.id);
  const { data: scheds } = semIds.length
    ? await supabase.from("schedules").select("semester_id, status").in("semester_id", semIds)
    : { data: [] };
  const byS = new Map<string, { total: number; ended: number; live: number; pending: number; draft: number }>();
  for (const r of scheds ?? []) {
    const b = byS.get(r.semester_id) ?? { total: 0, ended: 0, live: 0, pending: 0, draft: 0 };
    b.total++;
    if (r.status === "ENDED") b.ended++;
    else if (r.status === "LIVE" || r.status === "ACTIVE") b.live++;
    else if (r.status === "PENDING_MA") b.pending++;
    else if (r.status === "DRAFT") b.draft++;
    byS.set(r.semester_id, b);
  }
  const rows = (sems ?? []).map((s: any) => {
    const b = byS.get(s.id) ?? { total: 0, ended: 0, live: 0, pending: 0, draft: 0 };
    return {
      semester: s.name,
      status: s.status,
      distribution: s.distribution_status,
      sessions: b.total,
      ended: b.ended,
      live: b.live,
      pending: b.pending,
      progress_pct: pct(b.ended, b.total),
    };
  });
  return {
    title: "Semester progress",
    columns: [
      { key: "semester", label: "Semester" },
      { key: "status", label: "Status" },
      { key: "distribution", label: "Distribution" },
      { key: "sessions", label: "Sessions", align: "right" as const },
      { key: "ended", label: "Ended", align: "right" as const },
      { key: "live", label: "Live", align: "right" as const },
      { key: "pending", label: "Pending", align: "right" as const },
      { key: "progress_pct", label: "Progress %", align: "right" as const },
    ],
    rows,
  };
}

/* ------------------------------------------------------------------ */
/*  Department                                                         */
/* ------------------------------------------------------------------ */

async function departmentPerformance(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  const [{ data: depts }, scheds, atts] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    (() => {
      let q = supabase.from("schedules")
        .select("id, department_id, status, checkin_at, start_time, date")
        .gte("date", range.from).lte("date", range.to).limit(20000);
      q = applyDeptFilter(q, f.department_id);
      return q;
    })(),
    supabase.from("attendance_logs").select("present, schedule_id").gte("attendance_timestamp", `${range.from}T00:00:00Z`).lte("attendance_timestamp", `${range.to}T23:59:59Z`),
  ]);
  const schedById = new Map((scheds.data ?? []).map((s: any) => [s.id, s]));
  const aByDept = new Map<string, { total: number; present: number }>();
  for (const a of atts.data ?? []) {
    const s = schedById.get(a.schedule_id) as any;
    if (!s) continue;
    const b = aByDept.get(s.department_id) ?? { total: 0, present: 0 };
    b.total++;
    if (a.present) b.present++;
    aByDept.set(s.department_id, b);
  }
  const sByDept = new Map<string, any[]>();
  for (const s of scheds.data ?? []) {
    const arr = sByDept.get(s.department_id) ?? [];
    arr.push(s);
    sByDept.set(s.department_id, arr);
  }
  const rows = (depts ?? [])
    .filter((d: any) => !f.department_id || d.id === f.department_id)
    .map((d: any) => {
      const all = sByDept.get(d.id) ?? [];
      const ended = all.filter((s: any) => s.status === "ENDED").length;
      const att = aByDept.get(d.id) ?? { total: 0, present: 0 };
      const withCi = all.filter((s: any) => s.checkin_at && s.start_time);
      const punctual = withCi.filter((s: any) =>
        new Date(s.checkin_at).getTime() - new Date(`${s.date}T${s.start_time}`).getTime() <= 15 * 60_000,
      ).length;
      return {
        department: d.name,
        sessions: all.length,
        completion_pct: pct(ended, all.length),
        attendance_pct: pct(att.present, att.total),
        punctuality_pct: pct(punctual, withCi.length),
      };
    });
  return {
    title: `Department performance ${range.from} → ${range.to}`,
    columns: [
      { key: "department", label: "Department" },
      { key: "sessions", label: "Sessions", align: "right" as const },
      { key: "completion_pct", label: "Completion %", align: "right" as const },
      { key: "attendance_pct", label: "Attendance %", align: "right" as const },
      { key: "punctuality_pct", label: "Punctuality %", align: "right" as const },
    ],
    rows,
  };
}

async function trainerPerformance(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let q = supabase.from("schedules")
    .select("id, trainer_registry_id, trainer_name, status, checkin_at, start_time, date, department_id")
    .gte("date", range.from).lte("date", range.to).limit(20000);
  q = applyDeptFilter(q, f.department_id);
  if (f.trainer_registry_id) q = q.eq("trainer_registry_id", f.trainer_registry_id);
  const { data: scheds } = await q;
  const byT = new Map<string, { name: string; total: number; ended: number; punctual: number; withCi: number }>();
  for (const s of scheds ?? []) {
    const k = s.trainer_registry_id ?? "—";
    const b = byT.get(k) ?? { name: s.trainer_name ?? "—", total: 0, ended: 0, punctual: 0, withCi: 0 };
    b.total++;
    if (s.status === "ENDED") b.ended++;
    if (s.checkin_at && s.start_time) {
      b.withCi++;
      if (new Date(s.checkin_at).getTime() - new Date(`${s.date}T${s.start_time}`).getTime() <= 15 * 60_000) b.punctual++;
    }
    byT.set(k, b);
  }
  const rows = Array.from(byT.values()).map((b) => ({
    trainer: b.name,
    scheduled: b.total,
    completed: b.ended,
    completion_pct: pct(b.ended, b.total),
    punctuality_pct: pct(b.punctual, b.withCi),
  })).sort((a, b) => b.completion_pct - a.completion_pct);
  return {
    title: `Trainer performance ${range.from} → ${range.to}`,
    columns: [
      { key: "trainer", label: "Trainer" },
      { key: "scheduled", label: "Scheduled", align: "right" as const },
      { key: "completed", label: "Completed", align: "right" as const },
      { key: "completion_pct", label: "Completion %", align: "right" as const },
      { key: "punctuality_pct", label: "Punctuality %", align: "right" as const },
    ],
    rows,
  };
}

async function attendanceCompliance(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let q = supabase.from("schedules")
    .select("id, department_id, module_code, module_name, trainer_name, status, date")
    .gte("date", range.from).lte("date", range.to).limit(20000);
  q = applyDeptFilter(q, f.department_id);
  const { data: scheds } = await q;
  const ids = (scheds ?? []).map((s: any) => s.id);
  const { data: logs } = ids.length
    ? await supabase.from("session_logs").select("schedule_id, session_status").in("schedule_id", ids)
    : { data: [] };
  const logSet = new Set((logs ?? []).filter((l: any) => l.session_status === "COMPLETED").map((l: any) => l.schedule_id));
  const rows = (scheds ?? []).filter((s: any) => s.status === "ENDED" && !logSet.has(s.id)).map((s: any) => ({
    date: s.date,
    module_code: s.module_code,
    module: s.module_name,
    trainer: s.trainer_name,
    status: s.status,
  }));
  return {
    title: `Attendance compliance gaps ${range.from} → ${range.to}`,
    columns: [
      { key: "date", label: "Date" },
      { key: "module_code", label: "Code" },
      { key: "module", label: "Module" },
      { key: "trainer", label: "Trainer" },
      { key: "status", label: "Status" },
    ],
    rows,
    summary: [{ label: "Missing closeouts", value: rows.length }],
  };
}

async function activeSessions(supabase: any, f: ReportFilters) {
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from("schedules")
    .select("id, module_code, module_name, trainer_name, start_time, end_time, status, department_id, checkin_at, ended_at")
    .eq("date", today)
    .order("start_time").limit(2000);
  q = applyDeptFilter(q, f.department_id);
  const { data: rows } = await q;
  return {
    title: `Active sessions — ${today}`,
    columns: [
      { key: "module_code", label: "Code" },
      { key: "module_name", label: "Module" },
      { key: "trainer_name", label: "Trainer" },
      { key: "start_time", label: "Start" },
      { key: "end_time", label: "End" },
      { key: "status", label: "Status" },
      { key: "checkin_at", label: "Check-in" },
    ],
    rows: rows ?? [],
    summary: [{ label: "Today", value: (rows ?? []).length }],
  };
}

/* ------------------------------------------------------------------ */
/*  Admin                                                              */
/* ------------------------------------------------------------------ */

async function institutionSummary(supabase: any, _f: ReportFilters, range: { from: string; to: string }) {
  const [{ count: depts }, { count: trainers }, { count: students }, { count: modules }, { count: schedules }, { count: attendance }, { count: completed }] = await Promise.all([
    supabase.from("departments").select("*", { count: "exact", head: true }),
    supabase.from("trainer_registry").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("modules").select("*", { count: "exact", head: true }),
    supabase.from("schedules").select("*", { count: "exact", head: true }).gte("date", range.from).lte("date", range.to),
    supabase.from("attendance_logs").select("*", { count: "exact", head: true }).gte("attendance_timestamp", `${range.from}T00:00:00Z`),
    supabase.from("schedules").select("*", { count: "exact", head: true }).eq("status", "ENDED").gte("date", range.from).lte("date", range.to),
  ]);
  const rows = [
    { metric: "Departments", value: depts ?? 0 },
    { metric: "Active trainers", value: trainers ?? 0 },
    { metric: "Active students", value: students ?? 0 },
    { metric: "Modules", value: modules ?? 0 },
    { metric: `Schedules ${range.from} → ${range.to}`, value: schedules ?? 0 },
    { metric: "Completed schedules", value: completed ?? 0 },
    { metric: "Attendance records (since from)", value: attendance ?? 0 },
  ];
  return {
    title: "Institution summary",
    columns: [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", align: "right" as const }],
    rows,
  };
}

async function userActivity(supabase: any, _f: ReportFilters, range: { from: string; to: string }) {
  const { data: logs } = await supabase.from("audit_logs")
    .select("actor_id, action_type, entity_type, timestamp")
    .gte("timestamp", `${range.from}T00:00:00Z`).lte("timestamp", `${range.to}T23:59:59Z`)
    .limit(20000);
  const byUser = new Map<string, { actor_id: string; actions: number; types: Set<string> }>();
  for (const l of logs ?? []) {
    const b = byUser.get(l.actor_id) ?? { actor_id: l.actor_id, actions: 0, types: new Set<string>() };
    b.actions++;
    b.types.add(l.action_type);
    byUser.set(l.actor_id, b);
  }
  const ids = Array.from(byUser.keys()).filter(Boolean);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] };
  const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const rows = Array.from(byUser.values()).map((b) => {
    const p = pMap.get(b.actor_id) as any;
    return {
      user: p?.full_name || p?.email || (b.actor_id?.slice(0, 8) ?? "—"),
      actions: b.actions,
      action_types: Array.from(b.types).join(", "),
    };
  }).sort((a, b) => b.actions - a.actions);
  return {
    title: `User activity ${range.from} → ${range.to}`,
    columns: [
      { key: "user", label: "User" },
      { key: "actions", label: "Actions", align: "right" as const },
      { key: "action_types", label: "Action types" },
    ],
    rows,
    summary: [{ label: "Active users", value: rows.length }, { label: "Total actions", value: rows.reduce((a, r) => a + r.actions, 0) }],
  };
}

async function complianceSummary(supabase: any, _f: ReportFilters, range: { from: string; to: string }) {
  const { data: logs } = await supabase.from("session_logs")
    .select("geo_verified, session_status, submitted_at")
    .gte("submitted_at", `${range.from}T00:00:00Z`).lte("submitted_at", `${range.to}T23:59:59Z`)
    .limit(20000);
  const total = (logs ?? []).length;
  const geoOk = (logs ?? []).filter((l: any) => l.geo_verified).length;
  const completed = (logs ?? []).filter((l: any) => l.session_status === "COMPLETED").length;
  const { data: overrides } = await supabase.from("attendance_overrides")
    .select("id, override_timestamp").gte("override_timestamp", `${range.from}T00:00:00Z`).limit(20000);
  const rows = [
    { metric: "Session logs", value: total },
    { metric: "Geo-verified", value: `${geoOk} (${pct(geoOk, total)}%)` },
    { metric: "Completed logs", value: `${completed} (${pct(completed, total)}%)` },
    { metric: "Attendance overrides", value: (overrides ?? []).length },
  ];
  return {
    title: `Compliance summary ${range.from} → ${range.to}`,
    columns: [{ key: "metric", label: "Metric" }, { key: "value", label: "Value", align: "right" as const }],
    rows,
  };
}

/* ------------------------------------------------------------------ */
/*  Approvals                                                          */
/* ------------------------------------------------------------------ */

async function approvalReport(supabase: any, f: ReportFilters, range: { from: string; to: string }) {
  let q = supabase.from("approval_queue")
    .select("id, type, decision, comment, submitted_by, decided_by, created_at, decided_at, schedule_id")
    .gte("created_at", `${range.from}T00:00:00Z`).lte("created_at", `${range.to}T23:59:59Z`)
    .order("created_at", { ascending: false }).limit(5000);
  if (f.status && ["pending", "approved", "rejected"].includes(f.status)) q = q.eq("decision", f.status);
  const { data: rows } = await q;

  // Department filter goes via schedules
  let scoped = rows ?? [];
  if (f.department_id) {
    const ids = scoped.map((r: any) => r.schedule_id).filter(Boolean);
    const { data: scheds } = ids.length
      ? await supabase.from("schedules").select("id, department_id").in("id", ids).eq("department_id", f.department_id)
      : { data: [] };
    const ok = new Set((scheds ?? []).map((s: any) => s.id));
    scoped = scoped.filter((r: any) => r.schedule_id && ok.has(r.schedule_id));
  }

  const userIds = Array.from(new Set(scoped.flatMap((r: any) => [r.submitted_by, r.decided_by]).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] };
  const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));

  const out = scoped.map((r: any) => ({
    created_at: r.created_at,
    type: r.type,
    decision: r.decision,
    submitted_by: pMap.get(r.submitted_by) ?? "—",
    decided_by: pMap.get(r.decided_by) ?? "—",
    decided_at: r.decided_at ?? "—",
    comment: r.comment ?? "",
  }));

  const summary = [
    { label: "Total", value: out.length },
    { label: "Pending", value: out.filter((r: { decision: string }) => r.decision === "pending").length },
    { label: "Approved", value: out.filter((r: { decision: string }) => r.decision === "approved").length },
    { label: "Rejected", value: out.filter((r: { decision: string }) => r.decision === "rejected").length },
  ];
  return {
    title: `Approval report ${range.from} → ${range.to}`,
    columns: [
      { key: "created_at", label: "Submitted" },
      { key: "type", label: "Type" },
      { key: "decision", label: "Decision" },
      { key: "submitted_by", label: "Submitted by" },
      { key: "decided_by", label: "Decided by" },
      { key: "decided_at", label: "Decided at" },
      { key: "comment", label: "Comment" },
    ],
    rows: out,
    summary,
  };
}

/* ------------------------------------------------------------------ */
/*  Lookups for the filter bar                                         */
/* ------------------------------------------------------------------ */

export const getReportFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: depts }, { data: trainers }, { data: modules }, { data: sems }] = await Promise.all([
      context.supabase.from("departments").select("id, name").order("name"),
      context.supabase.from("trainer_registry").select("id, full_name, department_id").order("full_name").limit(1000),
      context.supabase.from("modules").select("id, code, name").order("code").limit(1000),
      context.supabase.from("semester_registry").select("id, name, start_date").order("start_date", { ascending: false }).limit(100),
    ]);
    const years = Array.from(new Set((sems ?? []).map((s: any) => s.start_date?.slice(0, 4)).filter(Boolean))) as string[];
    return {
      departments: depts ?? [],
      trainers: trainers ?? [],
      modules: modules ?? [],
      semesters: sems ?? [],
      academic_years: years,
    };
  });

/* ------------------------------------------------------------------ */
/*  Audit logger for client-side exports                                */
/* ------------------------------------------------------------------ */

const LogExportSchema = z.object({
  key: z.string(),
  format: z.enum(["csv", "xlsx", "pdf", "print"]),
  filters: z.record(z.string(), z.any()).default({}),
});

export const logExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LogExportSchema.parse(d))
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
