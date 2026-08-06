import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listDepartmentTrainers } from "@/lib/trainer-pool";

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
    const [trainers, { data: venues }, { data: sections }] = await Promise.all([
      listDepartmentTrainers(context.supabase, data.department_id, "id, full_name"),
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
      .select("id, date, day, week_num, semester_id, start_time, end_time, module_code, module_name, trainer_registry_id, trainer_name, venue_id, section_id, status")
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
    if (!sem) throw new Error("Level not found");
    const startDate = new Date(sem.start_date);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const trainers = await listDepartmentTrainers<{ id: string; full_name: string; hidden_staff_id: string | null }>(
      supabase,
      data.department_id,
      "id, full_name, hidden_staff_id",
    );
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
    type ConflictItem = {
      row: number;
      kind: "trainer" | "venue" | "section";
      date: string;
      start_time: string;
      end_time: string;
      resource_name: string;
      conflict_with: {
        scope: "intra_batch" | "existing";
        department_name: string | null;
        module_code: string;
        row_b?: number;
      };
      reason: string;
      // legacy fields preserved so older UI code still renders
      row_a: number;
      row_b: number;
    };
    const conflicts: ConflictItem[] = [];
    const hm = (t: string) => t.slice(0, 5);
    const trainerName = (id: string) =>
      (trainers ?? []).find((x) => x.id === id)?.full_name ?? "Trainer";
    const venueName = (id: string) =>
      (venues ?? []).find((x) => x.id === id)?.name ?? "Venue";
    const overlap = (a: any, b: any) => a.date === b.date && !(a.end_time <= b.start_time || b.end_time <= a.start_time);
    for (let i = 0; i < inserts.length; i++) {
      for (let j = i + 1; j < inserts.length; j++) {
        const a = inserts[i]; const b = inserts[j];
        if (!overlap(a, b)) continue;
        const mk = (kind: "trainer" | "venue" | "section", name: string): ConflictItem => ({
          row: a._row, row_a: a._row, row_b: b._row, kind, date: a.date,
          start_time: hm(a.start_time), end_time: hm(a.end_time),
          resource_name: name,
          conflict_with: { scope: "intra_batch", department_name: null, module_code: b.module_code, row_b: b._row },
          reason: `${kind === "trainer" ? "Trainer" : kind === "venue" ? "Venue" : "Section"} ${name} double-booked within this upload on ${a.date} ${hm(a.start_time)}–${hm(a.end_time)} (rows ${a._row + 1} and ${b._row + 1}).`,
        });
        if (a.trainer_registry_id === b.trainer_registry_id) conflicts.push(mk("trainer", trainerName(a.trainer_registry_id)));
        if (a.venue_id === b.venue_id) conflicts.push(mk("venue", venueName(a.venue_id)));
        if (a.section_id === b.section_id) conflicts.push(mk("section", `${a.module_code}`));
      }
    }

    // DB conflicts: existing schedules on same dates that overlap (exclude this semester's own drafts)
    if (inserts.length) {
      const dates = Array.from(new Set(inserts.map((i) => i.date)));
      // Global cross-departmental read: bypass DH RLS using the admin client
      // strictly for conflict detection. Writes below still go through the
      // user-scoped supabase client.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("schedules")
        .select("id, date, start_time, end_time, trainer_registry_id, venue_id, section_id, semester_id, module_code, department_id")
        .in("date", dates)
        .in("status", ["DRAFT", "PENDING_MA", "LIVE", "ACTIVE"]);

      const exTrainerIds = Array.from(new Set((existing ?? []).map((e: any) => e.trainer_registry_id).filter(Boolean)));
      const exVenueIds = Array.from(new Set((existing ?? []).map((e: any) => e.venue_id).filter(Boolean)));
      const exDeptIds = Array.from(new Set((existing ?? []).map((e: any) => e.department_id).filter(Boolean)));
      const [tRes, vRes, dRes] = await Promise.all([
        exTrainerIds.length ? supabaseAdmin.from("trainer_registry").select("id, full_name").in("id", exTrainerIds) : Promise.resolve({ data: [] as any[] }),
        exVenueIds.length ? supabaseAdmin.from("venues").select("id, name").in("id", exVenueIds) : Promise.resolve({ data: [] as any[] }),
        exDeptIds.length ? supabaseAdmin.from("departments").select("id, name").in("id", exDeptIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const exTrainer = new Map((tRes.data ?? []).map((x: any) => [x.id, x.full_name]));
      const exVenue = new Map((vRes.data ?? []).map((x: any) => [x.id, x.name]));
      const exDept = new Map((dRes.data ?? []).map((x: any) => [x.id, x.name]));

      for (const a of inserts) {
        for (const b of (existing ?? []) as any[]) {
          if (b.semester_id === data.semester_id) continue;
          if (!overlap(a, b)) continue;
          const deptName = exDept.get(b.department_id) ?? "another department";
          const push = (kind: "trainer" | "venue" | "section", name: string) => {
            const label = kind === "trainer" ? "Trainer" : kind === "venue" ? "Venue" : "Section";
            conflicts.push({
              row: a._row, row_a: a._row, row_b: -1, kind, date: a.date,
              start_time: hm(a.start_time), end_time: hm(a.end_time),
              resource_name: name,
              conflict_with: { scope: "existing", department_name: deptName, module_code: b.module_code },
              reason: `${label} ${name} is already booked by ${deptName} on ${a.date} ${hm(b.start_time)}–${hm(b.end_time)} (${b.module_code}).`,
            });
          };
          if (a.trainer_registry_id === b.trainer_registry_id) {
            push("trainer", exTrainer.get(b.trainer_registry_id) ?? trainerName(a.trainer_registry_id));
          }
          if (a.venue_id === b.venue_id) {
            push("venue", exVenue.get(b.venue_id) ?? venueName(a.venue_id));
          }
          if (b.department_id === data.department_id && a.section_id === b.section_id) {
            push("section", `${b.module_code}`);
          }
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
