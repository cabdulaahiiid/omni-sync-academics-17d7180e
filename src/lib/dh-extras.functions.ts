import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const swapTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      new_trainer_id: z.string().uuid(),
      reason: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dh_swap_trainer", {
      _schedule_id: data.schedule_id,
      _new_trainer: data.new_trainer_id,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Re-check conflicts for a proposed edit to a single schedule row.
 * Compares trainer/venue/section overlaps against all OTHER schedules on the
 * same date (excluding the schedule being edited).
 */
export const validateScheduleEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      schedule_id: z.string().uuid(),
      patch: z.object({
        date: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        venue_id: z.string().uuid().optional(),
        trainer_registry_id: z.string().uuid().optional(),
        section_id: z.string().uuid().optional(),
      }),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("schedules")
      .select("id, date, start_time, end_time, venue_id, trainer_registry_id, section_id")
      .eq("id", data.schedule_id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Schedule not found");

    const proposed = {
      date: data.patch.date ?? row.date,
      start_time: (data.patch.start_time ?? row.start_time).length === 5
        ? (data.patch.start_time ?? row.start_time) + ":00"
        : (data.patch.start_time ?? row.start_time),
      end_time: (data.patch.end_time ?? row.end_time).length === 5
        ? (data.patch.end_time ?? row.end_time) + ":00"
        : (data.patch.end_time ?? row.end_time),
      venue_id: data.patch.venue_id ?? row.venue_id,
      trainer_registry_id: data.patch.trainer_registry_id ?? row.trainer_registry_id,
      section_id: data.patch.section_id ?? row.section_id,
    };

    const { data: others } = await context.supabase
      .from("schedules")
      .select("id, date, start_time, end_time, venue_id, trainer_registry_id, section_id, module_code, trainer_name")
      .eq("date", proposed.date)
      .neq("id", data.schedule_id);

    const overlap = (a: any, b: any) =>
      !(a.end_time <= b.start_time || b.end_time <= a.start_time);

    const conflicts: { kind: "trainer" | "venue" | "section"; with_id: string; with_label: string }[] = [];
    for (const b of others ?? []) {
      if (!overlap(proposed, b)) continue;
      if (b.trainer_registry_id && proposed.trainer_registry_id === b.trainer_registry_id) {
        conflicts.push({ kind: "trainer", with_id: b.id, with_label: `${b.module_code} (${b.trainer_name})` });
      }
      if (b.venue_id && proposed.venue_id === b.venue_id) {
        conflicts.push({ kind: "venue", with_id: b.id, with_label: `${b.module_code}` });
      }
      if (b.section_id && proposed.section_id === b.section_id) {
        conflicts.push({ kind: "section", with_id: b.id, with_label: `${b.module_code}` });
      }
    }
    return { ok: conflicts.length === 0, conflicts, proposed };
  });

/** Department-scoped options for the Conflict Resolution Panel. */
export const getConflictPanelOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: trainers }, { data: venues }, { data: sections }] = await Promise.all([
      context.supabase.from("trainer_registry").select("id, full_name").eq("department_id", data.department_id).order("full_name"),
      context.supabase.from("venues").select("id, name").order("name"),
      context.supabase.from("sections").select("id, name, level_id").eq("department_id", data.department_id).order("name"),
    ]);
    return {
      trainers: trainers ?? [],
      venues: venues ?? [],
      sections: sections ?? [],
    };
  });

export const overrideAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      attendance_log_id: z.string().uuid(),
      new_value: z.boolean(),
      audit_comment: z.string().min(3).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dh_override_attendance", {
      _attendance_log_id: data.attendance_log_id,
      _new_value: data.new_value,
      _audit_comment: data.audit_comment,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Weekly matrix: trainers × dates with conflict flags
export const getWeeklyMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      week_start: z.string(),
      semester_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const start = new Date(data.week_start);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    let q = context.supabase
      .from("schedules")
      .select("id, date, day, start_time, end_time, module_code, module_name, trainer_registry_id, trainer_name, venue_id, status")
      .gte("date", fmt(start))
      .lte("date", fmt(end))
      .order("date")
      .order("start_time");
    if (data.semester_id) q = q.eq("semester_id", data.semester_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Conflict detection: same trainer or same venue overlapping time on same date
    const conflicts = new Set<string>();
    const list = rows ?? [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]; const b = list[j];
        if (a.date !== b.date) continue;
        const overlap = !(a.end_time <= b.start_time || b.end_time <= a.start_time);
        if (!overlap) continue;
        if (a.trainer_registry_id === b.trainer_registry_id || a.venue_id === b.venue_id) {
          conflicts.add(a.id); conflicts.add(b.id);
        }
      }
    }
    return {
      week_start: fmt(start),
      week_end: fmt(end),
      schedules: list.map((s) => ({ ...s, has_conflict: conflicts.has(s.id) })),
    };
  });

// Temporal Slicing Engine: parse semester rows -> 16 weekly buckets
const SliceRowSchema = z.object({
  module_code: z.string().min(1),
  module_name: z.string().min(1),
  trainer_name: z.string().min(1),
  frequency: z.number().int().min(1).max(7).default(1),
  duration_min: z.number().int().min(15).max(480),
  section_name: z.string().min(1),
  level_name: z.string().min(1),
  venue_name: z.string().min(1),
  day: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
});

const DAY_OFFSET: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

export const uploadSemesterSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid(),
      department_id: z.string().uuid(),
      rows: z.array(SliceRowSchema).min(1).max(2000),
      weeks: z.number().int().min(1).max(20).default(16),
      validate_only: z.boolean().optional().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sem } = await supabase
      .from("semester_registry").select("id, start_date").eq("id", data.semester_id).single();
    if (!sem) throw new Error("Semester not found");
    const startDate = new Date(sem.start_date);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: trainers } = await supabase
      .from("trainer_registry").select("id, full_name, hidden_staff_id").eq("department_id", data.department_id);
    const { data: levels } = await supabase
      .from("levels").select("id, name").eq("department_id", data.department_id);
    const { data: sections } = await supabase
      .from("sections").select("id, name, level_id").eq("department_id", data.department_id);
    const { data: venues } = await supabase.from("venues").select("id, name");

    const trainerByName = new Map((trainers ?? []).map((t) => [t.full_name.trim().toLowerCase(), t]));
    const levelByName = new Map((levels ?? []).map((l) => [String(l.name).trim().toLowerCase(), l]));
    const sectionByLevelName = new Map((sections ?? []).map((s) => [`${s.level_id}|${s.name.trim().toLowerCase()}`, s]));
    const venueByName = new Map((venues ?? []).map((v) => [v.name.trim().toLowerCase(), v]));

    const errors: { row: number; reason: string }[] = [];
    const inserts: any[] = [];

    data.rows.forEach((row, idx) => {
      const t = trainerByName.get(row.trainer_name.trim().toLowerCase());
      const l = levelByName.get(row.level_name.trim().toLowerCase());
      if (!t) { errors.push({ row: idx, reason: `Unknown trainer: ${row.trainer_name}` }); return; }
      if (!l) { errors.push({ row: idx, reason: `Unknown level: ${row.level_name}` }); return; }
      const sec = sectionByLevelName.get(`${l.id}|${row.section_name.trim().toLowerCase()}`);
      if (!sec) { errors.push({ row: idx, reason: `Unknown section: ${row.section_name}` }); return; }
      const venue = venueByName.get(row.venue_name.trim().toLowerCase());
      if (!venue) { errors.push({ row: idx, reason: `Unknown venue: ${row.venue_name}` }); return; }

      const [hh, mm] = row.start_time.split(":").map(Number);
      const endMinutes = hh * 60 + mm + row.duration_min;
      const eh = Math.floor(endMinutes / 60); const em = endMinutes % 60;
      const endTime = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;

      for (let w = 1; w <= data.weeks; w++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (w - 1) * 7 + DAY_OFFSET[row.day]);
        inserts.push({
          _row: idx,
          section_id: sec.id,
          level_id: l.id,
          module_code: row.module_code,
          module_name: row.module_name,
          trainer_registry_id: t.id,
          hidden_staff_id: t.hidden_staff_id,
          trainer_name: t.full_name,
          day: row.day,
          date: fmt(date),
          week_num: w,
          semester_id: data.semester_id,
          status: "DRAFT",
          start_time: row.start_time + ":00",
          end_time: endTime + ":00",
          venue_id: venue.id,
          created_by: userId,
          department_id: data.department_id,
        });
      }
    });

    // Intra-batch conflicts
    const conflicts: { row_a: number; row_b: number; date: string; kind: "trainer" | "venue" | "section" }[] = [];
    const overlap = (a: any, b: any) => a.date === b.date && !(a.end_time <= b.start_time || b.end_time <= a.start_time);
    for (let i = 0; i < inserts.length; i++) {
      for (let j = i + 1; j < inserts.length; j++) {
        const a = inserts[i]; const b = inserts[j];
        if (!overlap(a, b)) continue;
        if (a.trainer_registry_id === b.trainer_registry_id) conflicts.push({ row_a: a._row, row_b: b._row, date: a.date, kind: "trainer" });
        if (a.venue_id === b.venue_id) conflicts.push({ row_a: a._row, row_b: b._row, date: a.date, kind: "venue" });
        if (a.section_id === b.section_id) conflicts.push({ row_a: a._row, row_b: b._row, date: a.date, kind: "section" });
      }
    }

    // DB conflicts: existing schedules on same dates that overlap (exclude this semester's own drafts)
    if (inserts.length) {
      const dates = Array.from(new Set(inserts.map((i) => i.date)));
      const { data: existing } = await supabase
        .from("schedules")
        .select("id, date, start_time, end_time, trainer_registry_id, venue_id, section_id, semester_id, module_code")
        .in("date", dates);
      for (const a of inserts) {
        for (const b of existing ?? []) {
          if (b.semester_id === data.semester_id) continue;
          if (!overlap(a, b)) continue;
          if (a.trainer_registry_id === b.trainer_registry_id) conflicts.push({ row_a: a._row, row_b: -1, date: a.date, kind: "trainer" });
          if (a.venue_id === b.venue_id) conflicts.push({ row_a: a._row, row_b: -1, date: a.date, kind: "venue" });
          if (a.section_id === b.section_id) conflicts.push({ row_a: a._row, row_b: -1, date: a.date, kind: "section" });
        }
      }
    }

    if (errors.length || conflicts.length || data.validate_only) {
      return { ok: errors.length === 0 && conflicts.length === 0, created: 0, errors, conflicts, total_rows: data.rows.length };
    }

    // Replace any previous drafts for this semester before re-inserting
    await supabase.from("schedules").delete().eq("semester_id", data.semester_id).eq("status", "DRAFT");

    let created = 0;
    if (inserts.length) {
      const chunk = 200;
      for (let i = 0; i < inserts.length; i += chunk) {
        const slice = inserts.slice(i, i + chunk).map(({ _row, ...rest }) => rest);
        const { error } = await supabase.from("schedules").insert(slice);
        if (error) throw new Error(error.message);
        created += slice.length;
      }
    }
    // Ensure semester is in DRAFT state (do NOT auto-submit for approval)
    await supabase.from("semester_registry").update({ distribution_status: "DRAFT" }).eq("id", data.semester_id);
    return { ok: true, created, errors, conflicts, total_rows: data.rows.length };
  });
