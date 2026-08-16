/**
 * Canonical DH scheduling engine.
 *
 * Pure, deterministic and dependency-free so the exact same math runs in the
 * browser preview, in the server validation call and in the transactional
 * save. No other module may calculate sessions, weeks or end dates.
 */

export type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const DAY_ORDER: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_OFFSET: Record<Day, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

export type PlanParams = {
  /** Total contact minutes the module requires. */
  module_total_minutes: number;
  /** Length of one full session in minutes. */
  session_minutes: number;
  /** Frequency: how many sessions are taught each week. */
  sessions_per_week: number;
  delivery: "Theory" | "Practical" | "Both";
  theory_days: Day[];
  practical_days: Day[];
  /** YYYY-MM-DD */
  start_date: string;
  /** HH:MM */
  start_time: string;
  /** YYYY-MM-DD — hard stop from the academic term, optional. */
  term_end_date?: string | null;
};

export type GeneratedSession = {
  session_number: number;
  date: string;
  day: Day;
  week_num: number;
  week_label: string;
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  minutes: number;
  mode: "Theory" | "Practical";
};

export type EngineResult = {
  ok: boolean;
  sessions: GeneratedSession[];
  /** How many sessions the module hours require (incl. a short final one). */
  required_sessions: number;
  /** Minutes of the final, possibly shorter, session. */
  final_session_minutes: number;
  total_sessions: number;
  total_minutes: number;
  weeks: number;
  end_date: string | null;
  /** Minutes of the module that could not be scheduled before the term ends. */
  shortfall_minutes: number;
  errors: string[];
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toHms(hhmm: string) {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm;
}

export function addMinutes(hhmm: string, mins: number) {
  const [hh, mm] = hhmm.split(":").map(Number);
  const total = hh * 60 + mm + mins;
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const parseDate = (s: string) => new Date(`${s}T00:00:00Z`);
const mondayOf = (d: Date) => {
  const m = new Date(d);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
};

/** Teaching days actually in play for the chosen delivery mode, in week order. */
export function teachingDays(p: Pick<PlanParams, "delivery" | "theory_days" | "practical_days">): Day[] {
  const theory = p.delivery === "Practical" ? [] : p.theory_days;
  const practical = p.delivery === "Theory" ? [] : p.practical_days;
  const set = new Set<Day>([...theory, ...practical]);
  return DAY_ORDER.filter((d) => set.has(d));
}

/** total module hours ÷ session duration, with an explicit short final session. */
export function requiredSessions(module_total_minutes: number, session_minutes: number) {
  if (session_minutes <= 0 || module_total_minutes <= 0) {
    return { count: 0, final_minutes: 0 };
  }
  const full = Math.floor(module_total_minutes / session_minutes);
  const remainder = module_total_minutes % session_minutes;
  return {
    count: full + (remainder > 0 ? 1 : 0),
    final_minutes: remainder > 0 ? remainder : session_minutes,
  };
}

/**
 * Generate the canonical session list. Sessions stop as soon as the module's
 * required hours are met; the end date is the final generated session's date
 * and week numbers come from the generated sessions themselves (W1 = the
 * module's own first teaching week).
 */
export function generatePlan(p: PlanParams): EngineResult {
  const errors: string[] = [];
  const days = teachingDays(p);
  const perWeek = Math.max(1, Math.floor(p.sessions_per_week || 1));

  if (p.session_minutes <= 0) errors.push("Session duration must be greater than zero.");
  if (p.module_total_minutes <= 0) errors.push("This module has no total hours configured. Set the module hours first.");
  if (!days.length) errors.push("Pick at least one teaching day.");
  if (!p.start_date) errors.push("Pick a start date.");
  if (!/^\d{2}:\d{2}$/.test(p.start_time || "")) errors.push("Pick a start time.");

  const req = requiredSessions(p.module_total_minutes, p.session_minutes);
  if (errors.length) {
    return {
      ok: false, sessions: [], required_sessions: req.count, final_session_minutes: req.final_minutes,
      total_sessions: 0, total_minutes: 0, weeks: 0, end_date: null,
      shortfall_minutes: p.module_total_minutes, errors,
    };
  }

  const theory = new Set(p.delivery === "Practical" ? [] : p.theory_days);
  const practical = new Set(p.delivery === "Theory" ? [] : p.practical_days);

  const start = parseDate(p.start_date);
  const termEnd = p.term_end_date ? parseDate(p.term_end_date) : null;
  const firstMonday = mondayOf(start);

  const sessions: GeneratedSession[] = [];
  let remaining = p.module_total_minutes;
  let weekCursor = new Date(firstMonday);
  let guard = 0;

  while (sessions.length < req.count && guard < 520) {
    guard += 1;
    let placedThisWeek = 0;
    // Cycle through the teaching days; when a week needs more sessions than it
    // has days, extra sessions stack back-to-back on the same days in order.
    for (let pass = 0; placedThisWeek < perWeek && pass < 8; pass += 1) {
      for (const d of days) {
        if (placedThisWeek >= perWeek || sessions.length >= req.count) break;
        const date = new Date(weekCursor);
        date.setUTCDate(date.getUTCDate() + DAY_OFFSET[d]);
        if (date < start) continue;
        if (termEnd && date > termEnd) {
          return finalize(sessions, req, p, errors, remaining, true);
        }
        const minutes = Math.min(p.session_minutes, remaining);
        if (minutes <= 0) break;
        const startTime = addMinutes(p.start_time, pass * p.session_minutes);
        sessions.push({
          session_number: sessions.length + 1,
          date: fmtDate(date),
          day: d,
          week_num: 0, // assigned below from the generated sessions
          week_label: "",
          start_time: toHms(startTime),
          end_time: toHms(addMinutes(startTime, minutes)),
          minutes,
          mode: practical.has(d) && !theory.has(d) ? "Practical" : "Theory",
        });
        remaining -= minutes;
        placedThisWeek += 1;
      }
      if (placedThisWeek === 0) break; // no usable day this week
    }
    weekCursor.setUTCDate(weekCursor.getUTCDate() + 7);
  }

  return finalize(sessions, req, p, errors, remaining, false);
}

function finalize(
  sessions: GeneratedSession[],
  req: { count: number; final_minutes: number },
  p: PlanParams,
  errors: string[],
  remaining: number,
  hitTermEnd: boolean,
): EngineResult {
  sessions.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  sessions.forEach((s, i) => { s.session_number = i + 1; });

  // Weeks come from the generated sessions: W1 is the module's first teaching week.
  if (sessions.length) {
    const base = mondayOf(parseDate(sessions[0].date)).getTime();
    for (const s of sessions) {
      const w = Math.floor((mondayOf(parseDate(s.date)).getTime() - base) / (7 * 86_400_000)) + 1;
      s.week_num = w;
      s.week_label = `W${w}`;
    }
  }

  const total_minutes = sessions.reduce((n, s) => n + s.minutes, 0);
  const weeks = new Set(sessions.map((s) => s.week_num)).size;
  const shortfall = Math.max(0, remaining);

  const out: EngineResult = {
    ok: sessions.length > 0 && shortfall === 0,
    sessions,
    required_sessions: req.count,
    final_session_minutes: req.final_minutes,
    total_sessions: sessions.length,
    total_minutes,
    weeks,
    end_date: sessions.length ? sessions[sessions.length - 1].date : null,
    shortfall_minutes: shortfall,
    errors,
  };

  if (!sessions.length) {
    out.errors.push("No sessions could be generated — check the teaching days, start date and duration.");
  } else if (shortfall > 0) {
    out.errors.push(
      hitTermEnd
        ? `The academic term ends before all module hours fit — ${(shortfall / 60).toFixed(1)}h remain unscheduled. Start earlier or add teaching days.`
        : `${(shortfall / 60).toFixed(1)}h of module time could not be scheduled. Add teaching days or increase sessions per week.`,
    );
  }
  return out;
}

/** Group the canonical sessions into weeks — only weeks that hold sessions. */
export function groupByWeek(sessions: GeneratedSession[]) {
  const map = new Map<number, GeneratedSession[]>();
  for (const s of sessions) {
    const arr = map.get(s.week_num) ?? [];
    arr.push(s);
    map.set(s.week_num, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week_num, items]) => ({ week_num, week_label: `W${week_num}`, sessions: items }));
}