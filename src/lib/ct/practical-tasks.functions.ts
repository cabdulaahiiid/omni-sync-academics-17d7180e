import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ATTENDANCE = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const;

/**
 * Roster for the signed-in enterprise trainer: their placements, the practical
 * tasks planned for those placements and every task confirmation recorded so
 * far. RLS scopes all three reads to the mentor's own enterprise.
 */
export const listEnterprisePracticalWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: placements, error } = await supabase
      .from("ct_student_placements")
      .select(
        "id, student_id, department_id, schedule_id, start_date, end_date, status, locked, students(full_name, registration_number), ct_enterprises(name), departments(name)",
      )
      .in("status", ["CONFIRMED", "ACTIVE"])
      .order("start_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (placements ?? []).map((p) => p.id);
    const { data: confirmations } = ids.length
      ? await supabase
          .from("ct_practical_task_confirmations")
          .select(
            "id, placement_id, plan_task_id, task_title, competency_code, task_date, attendance, hours, performance_rating, safety_breach, remarks, status, version, decision_comment, decided_at, submitted_at",
          )
          .in("placement_id", ids)
          .order("task_date", { ascending: false })
          .limit(1000)
      : { data: [] as any[] };

    // Planned practical tasks for the department(s) in the roster, so the
    // trainer picks from the curriculum instead of typing free text.
    const departmentIds = Array.from(new Set((placements ?? []).map((p) => p.department_id).filter(Boolean)));
    const { data: planTasks } = departmentIds.length
      ? await supabase
          .from("schedule_plan_practical_tasks")
          .select("id, session_id, title, competency_code, description, department_id, sequence")
          .in("department_id", departmentIds as string[])
          .order("sequence")
          .limit(500)
      : { data: [] as any[] };

    return {
      placements: (placements ?? []) as any[],
      confirmations: (confirmations ?? []) as any[],
      planTasks: (planTasks ?? []) as any[],
    };
  });

/** Record enterprise attendance + performance for one practical sub-session. */
export const confirmPracticalTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placement_id: z.string().uuid(),
        plan_task_id: z.string().uuid().nullish(),
        task_title: z.string().trim().min(2).max(200),
        competency_code: z.string().trim().max(40).nullish(),
        task_date: z.string().min(10).max(10),
        attendance: z.enum(ATTENDANCE),
        hours: z.number().min(0).max(24),
        performance_rating: z.number().int().min(1).max(5),
        safety_breach: z.boolean().default(false),
        remarks: z.string().trim().max(1000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase.rpc as any)("ct_confirm_practical_task", {
      _placement_id: data.placement_id,
      _plan_task_id: data.plan_task_id ?? null,
      _task_title: data.task_title,
      _competency_code: data.competency_code ?? null,
      _task_date: data.task_date,
      _attendance: data.attendance,
      _hours: data.hours,
      _performance_rating: data.performance_rating,
      _safety_breach: data.safety_breach,
      _remarks: data.remarks ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: id as string };
  });

/** Approve / return / lock a submitted confirmation with a version guard. */
export const decidePracticalTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        confirmation_id: z.string().uuid(),
        decision: z.enum(["APPROVE", "RETURN", "LOCK"]),
        comment: z.string().trim().max(500).nullish(),
        expected_version: z.number().int().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase.rpc as any)("ct_decide_practical_task", {
      _confirmation_id: data.confirmation_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
      _expected_version: data.expected_version,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status: string; version: number };
  });

/** Audit-safe correction: never edits an approved record silently. */
export const correctPracticalTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        confirmation_id: z.string().uuid(),
        attendance: z.enum(ATTENDANCE),
        hours: z.number().min(0).max(24),
        performance_rating: z.number().int().min(1).max(5),
        safety_breach: z.boolean(),
        remarks: z.string().trim().max(1000).nullish(),
        reason: z.string().trim().min(5).max(500),
        expected_version: z.number().int().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase.rpc as any)("ct_correct_practical_task", {
      _confirmation_id: data.confirmation_id,
      _attendance: data.attendance,
      _hours: data.hours,
      _performance_rating: data.performance_rating,
      _safety_breach: data.safety_breach,
      _remarks: data.remarks ?? null,
      _reason: data.reason,
      _expected_version: data.expected_version,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; version: number };
  });

/** Correction trail for one confirmation. */
export const listPracticalTaskCorrections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirmation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ct_practical_task_corrections")
      .select("id, before_state, after_state, reason, corrected_by, corrected_at")
      .eq("confirmation_id", data.confirmation_id)
      .order("corrected_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { corrections: (rows ?? []) as any[] };
  });
