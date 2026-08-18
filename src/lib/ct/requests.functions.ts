import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";
import { evaluateTrainee } from "@/lib/ct/eligibility";

/**
 * Theory-completion queue. Attendance for each student is recomputed here from
 * the attendance log so eligibility can never be faked from the browser.
 */
export const listCtEligibleTrainees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        department_id: z.string().uuid().optional().nullable(),
        level_id: z.string().uuid().optional().nullable(),
        section_id: z.string().uuid().optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("students")
      .select("id, registration_number, full_name, department_id, level_id, section_id, status")
      .eq("status", "ACTIVE")
      .order("full_name")
      .limit(500);
    if (data.department_id) q = q.eq("department_id", data.department_id);
    if (data.level_id) q = q.eq("level_id", data.level_id);
    if (data.section_id) q = q.eq("section_id", data.section_id);
    const { data: students, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (students ?? []).map((s) => s.id);
    const [{ data: logs }, { data: settings }, { data: active }] = await Promise.all([
      ids.length
        ? supabase.from("attendance_logs").select("student_id, present").in("student_id", ids)
        : Promise.resolve({ data: [] as { student_id: string; present: boolean }[] }),
      supabase.from("ct_settings").select("theory_threshold_percent").limit(1).maybeSingle(),
      ids.length
        ? supabase
            .from("ct_student_placements")
            .select("student_id")
            .in("student_id", ids)
            .in("status", ["PENDING", "CONFIRMED", "ACTIVE"])
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);

    const threshold = Number(settings?.theory_threshold_percent ?? 80);
    const totals = new Map<string, { present: number; all: number }>();
    for (const l of logs ?? []) {
      const t = totals.get(l.student_id) ?? { present: 0, all: 0 };
      t.all += 1;
      if (l.present) t.present += 1;
      totals.set(l.student_id, t);
    }
    const placed = new Set((active ?? []).map((a) => a.student_id));

    return {
      threshold,
      students: (students ?? []).map((s) => {
        const verdict = evaluateTrainee(totals.get(s.id), {
          threshold,
          alreadyPlaced: placed.has(s.id),
        });
        return { ...s, ...verdict };
      }),
    };
  });

export const listCtRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ct_training_requests")
      .select(
        "id, reference, title, status, department_id, occupation_id, level_id, section_id, requested_start_date, requested_end_date, notes, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r) => r.id);
    const [{ data: members }, { data: placements }] = await Promise.all([
      ids.length
        ? context.supabase
            .from("ct_training_request_students")
            .select("request_id, student_id, theory_percent, eligible, students(full_name, registration_number)")
            .in("request_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? context.supabase
            .from("ct_student_placements")
            .select("id, request_id, student_id, enterprise_id, status, locked")
            .in("request_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return {
      requests: data ?? [],
      members: (members ?? []) as any[],
      placements: (placements ?? []) as any[],
    };
  });

const createSchema = z.object({
  department_id: z.string().uuid(),
  occupation_id: z.string().uuid(),
  training_module_id: z.string().uuid().optional().nullable(),
  level_id: z.string().uuid().optional().nullable(),
  section_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(3).max(150),
  notes: z.string().trim().max(1000).optional().nullable(),
  requested_start_date: z.string().min(10),
  requested_end_date: z.string().min(10),
  student_ids: z.array(z.string().uuid()).min(1, "Select at least one trainee"),
});

export const createCtRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "IPS"], "createCtRequest");
    const { student_ids, ...payload } = data;
    if (new Date(payload.requested_end_date) < new Date(payload.requested_start_date)) {
      throw new Error("The end date must be on or after the start date.");
    }
    const { data: id, error } = await (context.supabase.rpc as any)("ct_create_request", {
      _payload: payload as any,
      _student_ids: student_ids,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const submitCtRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "IPS"], "submitCtRequest");
    const { error } = await (context.supabase.rpc as any)("ct_submit_request", { _request_id: data.request_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const delegateCtRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "IPS"], "delegateCtRequest");
    const { error } = await (context.supabase.rpc as any)("ct_delegate_request", {
      _request_id: data.request_id,
      _to_user: data.to_user_id,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Coordinators available to receive a delegation. */
export const listCtCoordinators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["CO", "PD", "DH"]);
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
    if (!ids.length) return [];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, department_id")
      .in("id", ids);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });
