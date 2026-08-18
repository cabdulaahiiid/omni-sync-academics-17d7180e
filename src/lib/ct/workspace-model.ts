/** Pure derivations used by the placement, logbook, supervision and report screens. */

export type Row = Record<string, any>;

export function indexBy<T extends Row>(rows: T[], key = "id") {
  const map = new Map<string, T>();
  for (const r of rows) map.set(String(r[key]), r);
  return map;
}

export function groupBy<T extends Row>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = String(r[key]);
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return map;
}

export function workingDaysBetween(start: string, end: string, today = new Date()) {
  const from = new Date(start);
  const to = new Date(end);
  const last = to < today ? to : today;
  if (Number.isNaN(from.getTime()) || Number.isNaN(last.getTime()) || last < from) return 0;
  let days = 0;
  const cursor = new Date(from);
  while (cursor <= last) {
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export type LogbookSummary = {
  total: number;
  approved: number;
  submitted: number;
  rejected: number;
  draft: number;
  hours: number;
  expectedDays: number;
  missingDays: number;
  compliance: number;
};

export function summariseLogbook(entries: Row[], placement: Row, today = new Date()): LogbookSummary {
  const count = (status: string) => entries.filter((e) => e.status === status).length;
  const hours = entries.reduce((sum, e) => sum + Number(e.hours ?? 0), 0);
  const expectedDays =
    placement?.start_date && placement?.end_date
      ? workingDaysBetween(placement.start_date, placement.end_date, today)
      : 0;
  const logged = new Set(entries.map((e) => e.entry_date)).size;
  const missingDays = Math.max(expectedDays - logged, 0);
  return {
    total: entries.length,
    approved: count("APPROVED"),
    submitted: count("SUBMITTED"),
    rejected: count("REJECTED"),
    draft: count("DRAFT"),
    hours: Math.round(hours * 10) / 10,
    expectedDays,
    missingDays,
    compliance: expectedDays === 0 ? 100 : Math.min(100, Math.round((logged / expectedDays) * 100)),
  };
}

export function supervisionGap(visits: Row[], placement: Row, today = new Date()) {
  if (visits.length === 0) return { visits: 0, lastVisit: null as string | null, overdue: Boolean(placement?.start_date) };
  const sorted = [...visits].sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)));
  const last = sorted[sorted.length - 1]!.visit_date as string;
  const daysSince = Math.floor((today.getTime() - new Date(last).getTime()) / 86_400_000);
  return { visits: visits.length, lastVisit: last, overdue: daysSince > 14 };
}

export function evaluationOutcome(evaluations: Row[]) {
  const finalized = evaluations.filter((e) => e.finalized);
  const latest = finalized[finalized.length - 1] ?? evaluations[evaluations.length - 1] ?? null;
  return {
    count: evaluations.length,
    finalized: finalized.length,
    recommendation: (latest?.recommendation ?? null) as string | null,
    readyForAssessment: latest?.recommendation === "READY_FOR_ASSESSMENT",
    failedUc: Number(latest?.failed_uc_count ?? 0),
    redCompetencies: Number(latest?.red_competency_count ?? 0),
  };
}
