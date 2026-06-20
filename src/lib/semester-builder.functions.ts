import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
const DAY_OFFSET: Record<Day, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const pad2 = (n: number) => String(n).padStart(2, "0");
const toHms = (hhmm: string) => (hhmm.length === 5 ? hhmm + ":00" : hhmm);
const addMinutes = (hhmm: string, mins: number) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  const total = hh * 60 + mm + mins;
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}`;
};

/**
 * Load every option list the Semester Schedule Builder needs in one round-trip.
 * DH callers get their department; MA may pass any department_id.
 */
export const getBuilderOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const roles = await requireRole(context, ["DH", "MA"], "getBuilderOptions");
    const { supabase, userId } = context;

    // Resolve department: MA may target any dept (or none), DH is locked to their own.
    let deptId = data.department_id ?? null;
    if (!roles.includes("MA")) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", userId)
        .maybeSingle();
      deptId = prof?.department_id ?? null;
    }

    const [
      { data: semesters },
      { data: modules },
      { data: linkedProfiles },
      { data: levels },
      { data: sections },
      { data: venues },
      { data: depts },
    ] = await Promise.all([
      supabase.from("semester_registry").select("id, name, start_date, end_date, status, distribution_status").order("start_date", { ascending: false }),
      deptId
        ? supabase.from("modules").select("id, code, name, type, total_hours, total_sessions, department_id, level_id").eq("department_id", deptId).order("code")
        : supabase.from("modules").select("id, code, name, type, total_hours, total_sessions, department_id, level_id").order("code"),
      // Every trainer registered for the department — union of primary
      // department (trainer_registry.department_id) and multi-dept assignments
      // (trainer_departments). Login/profile is optional: trainers without a
      // login still appear by their registry name; trainers with a login show
      // their login email when available.
      (async () => {
        let trs: any[] = [];
        if (deptId) {
          const [{ data: primary }, { data: tdRows }] = await Promise.all([
            supabase
              .from("trainer_registry")
              .select("id, hidden_staff_id, full_name, department_id, sessions_target")
              .eq("department_id", deptId),
            supabase
              .from("trainer_departments")
              .select("trainer_registry_id")
              .eq("department_id", deptId),
          ]);
          const byId = new Map<string, any>();
          for (const t of primary ?? []) byId.set(t.id, t);
          const extraIds = (tdRows ?? [])
            .map((r: any) => r.trainer_registry_id)
            .filter((id: string) => id && !byId.has(id));
          if (extraIds.length) {
            const { data: extras } = await supabase
              .from("trainer_registry")
              .select("id, hidden_staff_id, full_name, department_id, sessions_target")
              .in("id", extraIds);
            for (const t of extras ?? []) byId.set(t.id, t);
          }
          trs = Array.from(byId.values());
        } else {
          const { data: all } = await supabase
            .from("trainer_registry")
            .select("id, hidden_staff_id, full_name, department_id, sessions_target");
          trs = all ?? [];
        }
        if (!trs.length) return { data: [] as any[] };
        // Left-join profile data for login email + canonical display name.
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email, trainer_registry_id")
          .in("trainer_registry_id", trs.map((t) => t.id));
        const profByTr = new Map(
          (profs ?? []).map((p: any) => [p.trainer_registry_id, p]),
        );
        return {
          data: trs.map((t: any) => ({
            ...t,
            full_name: profByTr.get(t.id)?.full_name || t.full_name,
            email: profByTr.get(t.id)?.email,
          })),
        };
      })(),
      deptId
        ? supabase.from("levels").select("id, name, department_id").eq("department_id", deptId).order("name")
        : supabase.from("levels").select("id, name, department_id").order("name"),
      deptId
        ? supabase.from("sections").select("id, name, level_id, department_id").eq("department_id", deptId).order("name")
        : supabase.from("sections").select("id, name, level_id, department_id").order("name"),
      supabase.from("venues").select("id, name, type, capacity").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);

    type TrainerRow = { id: string; hidden_staff_id: string; full_name: string; department_id: string; sessions_target: number; email?: string };
    const trainers: TrainerRow[] = ((linkedProfiles as any)?.data ?? linkedProfiles ?? [])
      .map((t: any) => ({
        id: t.id,
        hidden_staff_id: t.email ?? t.hidden_staff_id,
        full_name: t.full_name,
        department_id: t.department_id,
        sessions_target: t.sessions_target ?? 0,
        email: t.email,
      }))
      .sort((a: TrainerRow, b: TrainerRow) => a.full_name.localeCompare(b.full_name));

    return {
      department_id: deptId,
      can_pick_department: roles.includes("MA"),
      departments: depts ?? [],
      semesters: semesters ?? [],
      modules: modules ?? [],
      trainers: trainers ?? [],
      levels: levels ?? [],
      sections: sections ?? [],
      venues: venues ?? [],
    };
  });

/** Aggregate currently-assigned weekly minutes per trainer for the chosen semester. */
export const getTrainerLoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["DH", "MA"], "getTrainerLoad");
    const { data: rows } = await context.supabase
      .from("schedules")
      .select("trainer_registry_id, week_num, start_time, end_time")
      .eq("semester_id", data.semester_id)
      .in("status", ["DRAFT", "PENDING_MA", "LIVE", "ACTIVE", "ENDED"]);
    const perTrainer: Record<string, { weekly_minutes: number; total_minutes: number; weeks: Set<number> }> = {};
    for (const r of rows ?? []) {
      if (!r.trainer_registry_id) continue;
      const [sh, sm] = String(r.start_time).split(":").map(Number);
      const [eh, em] = String(r.end_time).split(":").map(Number);
      const mins = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      const entry = perTrainer[r.trainer_registry_id] ??= { weekly_minutes: 0, total_minutes: 0, weeks: new Set() };
      entry.total_minutes += mins;
      entry.weeks.add(r.week_num ?? 1);
    }
    const out: Record<string, { weekly_minutes: number; total_minutes: number; weeks: number }> = {};
    for (const [id, v] of Object.entries(perTrainer)) {
      const weeks = Math.max(1, v.weeks.size);
      out[id] = {
        total_minutes: v.total_minutes,
        weeks,
        weekly_minutes: Math.round(v.total_minutes / weeks),
      };
    }
    return out;
  });

const BuilderInput = z.object({
  semester_id: z.string().uuid(),
  department_id: z.string().uuid(),
  module_id: z.string().uuid(),
  trainer_id: z.string().uuid(),
  section_id: z.string().uuid(),
  level_id: z.string().uuid(),
  venue_id: z.string().uuid(),
  delivery: z.enum(["Theory", "Practical", "Both"]),
  theory_days: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).default([]),
  theory_session_name: z.string().max(120).optional().default(""),
  practical_days: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).default([]),
  practical_session_name: z.string().max(120).optional().default(""),
  start_date: z.string(), // YYYY-MM-DD
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  duration_hours: z.number().int().min(0).max(8),
  duration_minutes: z.number().int().min(0).max(59),
});

type BuilderInputT = z.infer<typeof BuilderInput>;

type Occurrence = {
  date: string;
  day: Day;
  week_num: number;
  start_time: string; // HH:MM:SS
  end_time: string;
  mode: "Theory" | "Practical";
};

function planOccurrences(input: BuilderInputT, semStart: string, semEnd: string) {
  const duration_min = input.duration_hours * 60 + input.duration_minutes;
  if (duration_min <= 0) return { occurrences: [] as Occurrence[], duration_min, weeks: 0, days: [] as Day[] };

  const startDate = new Date(input.start_date + "T00:00:00Z");
  const endDate = new Date(semEnd + "T00:00:00Z");
  const semStartD = new Date(semStart + "T00:00:00Z");
  // Anchor weeks to the semester's Monday so week_num matches the rest of the app.
  const semMonday = new Date(semStartD);
  semMonday.setUTCDate(semMonday.getUTCDate() - ((semMonday.getUTCDay() + 6) % 7));

  const theory = input.delivery === "Practical" ? [] : (input.theory_days as Day[]);
  const practical = input.delivery === "Theory" ? [] : (input.practical_days as Day[]);
  const allDays = Array.from(new Set([...theory, ...practical])) as Day[];

  const end_time_hhmm = addMinutes(input.start_time, duration_min);
  const occurrences: Occurrence[] = [];

  // Iterate week by week from the start_date until semester end.
  const cursorMon = new Date(startDate);
  cursorMon.setUTCDate(cursorMon.getUTCDate() - ((cursorMon.getUTCDay() + 6) % 7));
  while (cursorMon <= endDate) {
    for (const d of allDays) {
      const day = new Date(cursorMon);
      day.setUTCDate(day.getUTCDate() + DAY_OFFSET[d]);
      if (day < startDate || day > endDate) continue;
      const weekFromSem = Math.floor((day.getTime() - semMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const mode: "Theory" | "Practical" = practical.includes(d) && !theory.includes(d)
        ? "Practical"
        : "Theory";
      occurrences.push({
        date: fmtDate(day),
        day: d,
        week_num: Math.max(1, weekFromSem),
        start_time: toHms(input.start_time),
        end_time: toHms(end_time_hhmm),
        mode,
      });
    }
    cursorMon.setUTCDate(cursorMon.getUTCDate() + 7);
  }

  occurrences.sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const uniqWeeks = new Set(occurrences.map((o) => o.week_num)).size;
  return { occurrences, duration_min, weeks: uniqWeeks, days: allDays };
}

async function detectConflicts(input: BuilderInputT, occurrences: Occurrence[]) {
  if (!occurrences.length) return [] as Array<{ kind: "trainer" | "venue" | "section"; severity: "red"; date: string; reason: string }>;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dates = Array.from(new Set(occurrences.map((o) => o.date)));
  const { data: existing } = await supabaseAdmin
    .from("schedules")
    .select("id, date, start_time, end_time, trainer_registry_id, venue_id, section_id, semester_id, module_code, department_id")
    .in("date", dates)
    .in("status", ["DRAFT", "PENDING_MA", "LIVE", "ACTIVE"]);

  const overlap = (a: { start_time: string; end_time: string }, b: { start_time: string; end_time: string }) =>
    !(a.end_time <= b.start_time || b.end_time <= a.start_time);

  const conflicts: Array<{ kind: "trainer" | "venue" | "section"; severity: "red"; date: string; reason: string }> = [];
  const byDate = new Map<string, typeof existing>();
  for (const e of existing ?? []) {
    const arr = byDate.get(e.date) ?? ([] as any);
    arr.push(e as any);
    byDate.set(e.date, arr);
  }
  for (const occ of occurrences) {
    const peers = byDate.get(occ.date) ?? [];
    for (const b of peers) {
      if (!overlap(occ, b as any)) continue;
      if ((b as any).trainer_registry_id === input.trainer_id) {
        conflicts.push({ kind: "trainer", severity: "red", date: occ.date, reason: `Trainer is already booked on ${occ.date} ${(b as any).start_time.slice(0, 5)}–${(b as any).end_time.slice(0, 5)} (${(b as any).module_code}).` });
      }
      if ((b as any).venue_id === input.venue_id) {
        conflicts.push({ kind: "venue", severity: "red", date: occ.date, reason: `Venue is already booked on ${occ.date} ${(b as any).start_time.slice(0, 5)}–${(b as any).end_time.slice(0, 5)} (${(b as any).module_code}).` });
      }
      if ((b as any).section_id === input.section_id && (b as any).department_id === input.department_id) {
        conflicts.push({ kind: "section", severity: "red", date: occ.date, reason: `Section already has a class on ${occ.date} ${(b as any).start_time.slice(0, 5)}–${(b as any).end_time.slice(0, 5)} (${(b as any).module_code}).` });
      }
    }
  }
  return conflicts;
}

export const validateBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuilderInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["DH", "MA"], "validateBuilder");
    const { supabase } = context;

    const { data: sem } = await supabase
      .from("semester_registry")
      .select("id, name, start_date, end_date")
      .eq("id", data.semester_id)
      .maybeSingle();
    if (!sem) throw new Error("Semester not found");

    const plan = planOccurrences(data, sem.start_date, sem.end_date);
    if (!plan.occurrences.length) {
      return {
        ok: false,
        summary: { weekly_minutes: 0, total_minutes: 0, occurrences: 0, weeks: 0, end_date: data.start_date, end_time: data.start_time },
        conflicts: [], warnings: [{ severity: "yellow" as const, reason: "No sessions generated — check delivery days, dates, and duration." }],
      };
    }

    const [{ data: venue }, { data: module_ }, { data: trainerSchedRows }] = await Promise.all([
      supabase.from("venues").select("id, name, capacity, type").eq("id", data.venue_id).maybeSingle(),
      supabase.from("modules").select("id, code, name, type, total_hours, total_sessions").eq("id", data.module_id).maybeSingle(),
      supabase
        .from("schedules")
        .select("week_num, start_time, end_time, trainer_registry_id")
        .eq("semester_id", data.semester_id)
        .eq("trainer_registry_id", data.trainer_id)
        .in("status", ["DRAFT", "PENDING_MA", "LIVE", "ACTIVE", "ENDED"]),
    ]);

    const conflicts = await detectConflicts(data, plan.occurrences);
    const warnings: Array<{ severity: "yellow"; reason: string }> = [];

    // Venue type vs delivery
    if (venue) {
      const t = venue.type;
      if (data.delivery === "Practical" && t === "Classroom") {
        warnings.push({ severity: "yellow", reason: "Practical sessions are usually in Lab/Workshop, not a Classroom." });
      }
      if (data.delivery === "Theory" && (t === "Lab" || t === "Workshop")) {
        warnings.push({ severity: "yellow", reason: `Theory sessions are usually in a Classroom, not a ${t}.` });
      }
    }

    // Trainer overload (rough): existing weekly + proposed weekly > 1800 min (~30h)
    if (trainerSchedRows && trainerSchedRows.length) {
      const totalsByWeek = new Map<number, number>();
      for (const r of trainerSchedRows) {
        const [sh, sm] = String(r.start_time).split(":").map(Number);
        const [eh, em] = String(r.end_time).split(":").map(Number);
        totalsByWeek.set(r.week_num ?? 1, (totalsByWeek.get(r.week_num ?? 1) ?? 0) + Math.max(0, eh * 60 + em - sh * 60 - sm));
      }
      const proposedPerWeek = plan.occurrences.length / Math.max(1, plan.weeks) * plan.duration_min;
      const maxExisting = Math.max(0, ...Array.from(totalsByWeek.values()));
      if (maxExisting + proposedPerWeek > 30 * 60) {
        warnings.push({ severity: "yellow", reason: `Trainer weekly load would exceed 30 hours (${Math.round((maxExisting + proposedPerWeek) / 60 * 10) / 10}h).` });
      }
    }

    // Module contact hour cap
    if (module_ && module_.total_hours > 0) {
      const proposedHours = (plan.occurrences.length * plan.duration_min) / 60;
      if (proposedHours > module_.total_hours * 1.1) {
        warnings.push({ severity: "yellow", reason: `Proposed contact hours (${proposedHours.toFixed(1)}h) exceed module total (${module_.total_hours}h).` });
      }
    }

    const last = plan.occurrences[plan.occurrences.length - 1];
    return {
      ok: conflicts.length === 0,
      summary: {
        weekly_minutes: Math.round(plan.occurrences.length / Math.max(1, plan.weeks) * plan.duration_min),
        total_minutes: plan.occurrences.length * plan.duration_min,
        occurrences: plan.occurrences.length,
        weeks: plan.weeks,
        end_date: last.date,
        end_time: last.end_time.slice(0, 5),
      },
      conflicts,
      warnings,
    };
  });

export const saveBuilderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BuilderInput.parse(d))
  .handler(async ({ data, context }) => {
    const roles = await requireRole(context, ["DH", "MA"], "saveBuilderDraft");
    const { supabase, userId } = context;

    // DH may only write to their own department.
    if (!roles.includes("MA")) {
      const { data: prof } = await supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle();
      if (!prof?.department_id || prof.department_id !== data.department_id) {
        throw new Error("Out of department");
      }
    }

    const [{ data: sem }, { data: mod }, { data: trainer }, { data: venue }, { data: section }, { data: level }] = await Promise.all([
      supabase.from("semester_registry").select("id, start_date, end_date").eq("id", data.semester_id).maybeSingle(),
      supabase.from("modules").select("id, code, name, type, department_id, level_id").eq("id", data.module_id).maybeSingle(),
      supabase.from("trainer_registry").select("id, full_name, hidden_staff_id, department_id").eq("id", data.trainer_id).maybeSingle(),
      supabase.from("venues").select("id, name").eq("id", data.venue_id).maybeSingle(),
      supabase.from("sections").select("id, name, level_id, department_id").eq("id", data.section_id).maybeSingle(),
      supabase.from("levels").select("id, name, department_id").eq("id", data.level_id).maybeSingle(),
    ]);
    if (!sem) throw new Error("Semester not found");
    if (!mod || !trainer || !venue || !section || !level) throw new Error("One of the selected references does not exist");
    if (mod.department_id !== data.department_id) throw new Error("Module does not belong to that department");
    if (trainer.department_id !== data.department_id) throw new Error("Trainer does not belong to that department");
    if (section.department_id !== data.department_id) throw new Error("Section does not belong to that department");
    if (level.department_id !== data.department_id) throw new Error("Level does not belong to that department");
    if (section.level_id !== data.level_id) throw new Error("Section does not belong to the chosen level");

    const plan = planOccurrences(data, sem.start_date, sem.end_date);
    if (!plan.occurrences.length) throw new Error("No sessions to save — check delivery days, dates, and duration.");

    const conflicts = await detectConflicts(data, plan.occurrences);
    if (conflicts.length) {
      throw new Error(`Save blocked by ${conflicts.length} conflict(s). Resolve them before saving.`);
    }

    const inserts = plan.occurrences.map((o) => ({
      semester_id: data.semester_id,
      department_id: data.department_id,
      level_id: data.level_id,
      section_id: data.section_id,
      venue_id: data.venue_id,
      module_code: mod.code,
      module_name: mod.name,
      trainer_registry_id: data.trainer_id,
      hidden_staff_id: trainer.hidden_staff_id,
      trainer_name: trainer.full_name,
      date: o.date,
      day: o.day,
      week_num: o.week_num,
      start_time: o.start_time,
      end_time: o.end_time,
      status: "DRAFT" as const,
      created_by: userId,
    }));

    let created = 0;
    const chunk = 200;
    for (let i = 0; i < inserts.length; i += chunk) {
      const slice = inserts.slice(i, i + chunk);
      const { error } = await supabase.from("schedules").insert(slice);
      if (error) throw new Error(error.message);
      created += slice.length;
    }

    await supabase.from("semester_registry").update({ distribution_status: "DRAFT" }).eq("id", data.semester_id);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: "BUILDER_SAVE_DRAFT",
      entity_type: "semester",
      entity_id: data.semester_id,
      after_state: {
        module: mod.code, trainer: trainer.full_name, section: section.name,
        venue: venue.name, delivery: data.delivery, occurrences: created,
        days: plan.days, weeks: plan.weeks, duration_min: plan.duration_min,
      } as any,
    });
    return { ok: true, created, weeks: plan.weeks };
  });