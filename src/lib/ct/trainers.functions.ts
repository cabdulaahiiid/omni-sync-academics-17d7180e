import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";
import { listDepartmentTrainers } from "@/lib/trainer-pool";

const ACTIVE_PLACEMENT_STATUSES = ["PENDING", "CONFIRMED", "ACTIVE"];

/**
 * Trainers that belong to a department (home department + multi-department
 * assignments), with their current practical-training load and the
 * department's competency tags. RLS still governs every read.
 */
export const listCtDepartmentTrainers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid().optional().nullable() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, department_id")
      .eq("id", userId)
      .maybeSingle();

    const departmentId = data.department_id ?? (profile as any)?.department_id ?? null;
    if (!departmentId) return { department_id: null, trainers: [] as any[], competencies: [] as any[] };

    // Access check: the DB helper decides whether this caller may read the
    // department; admins and practical-training roles pass, other DHs do not.
    const { data: allowed } = await (supabase.rpc as any)("ct_can_access_department", {
      _department_id: departmentId,
    });
    if (allowed === false) {
      return { department_id: departmentId, trainers: [], competencies: [], forbidden: true };
    }

    const trainers = await listDepartmentTrainers<any>(
      supabase,
      departmentId,
      "id, full_name, phone, department_id",
    );

    const ids = trainers.map((t) => t.id);
    const [{ data: loads }, { data: competencies }] = await Promise.all([
      ids.length
        ? supabase
            .from("ct_student_placements")
            .select("visiting_trainer_id, status")
            .in("visiting_trainer_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      (supabase.from("ct_department_competencies" as any) as any)
        .select("id, name, critical, active, sort_order")
        .eq("department_id", departmentId)
        .eq("active", true)
        .order("sort_order"),
    ]);

    const loadByTrainer = new Map<string, number>();
    for (const row of ((loads as any[]) ?? []).filter((r) =>
      ACTIVE_PLACEMENT_STATUSES.includes(String(r.status)),
    )) {
      const key = String(row.visiting_trainer_id);
      loadByTrainer.set(key, (loadByTrainer.get(key) ?? 0) + 1);
    }

    return {
      department_id: departmentId,
      competencies: ((competencies as any[]) ?? []).map((c) => ({ id: c.id, name: c.name, critical: c.critical })),
      trainers: trainers.map((t) => {
        const load = loadByTrainer.get(String(t.id)) ?? 0;
        return {
          id: t.id,
          full_name: t.full_name,
          phone: t.phone ?? null,
          department_id: t.department_id,
          assigned_load: load,
          availability: load === 0 ? "FREE" : load < 8 ? "AVAILABLE" : "FULL",
        };
      }),
    };
  });

/** Assign / change the department trainer responsible for a placement. */
export const setCtPlacementTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placement_id: z.string().uuid(),
        trainer_registry_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireRole(context as any, ["MA", "DH", "IPS", "PD"], "setCtPlacementTrainer");

    const { data: placement, error: readErr } = await supabase
      .from("ct_student_placements")
      .select("id, department_id, locked, status")
      .eq("id", data.placement_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!placement) throw new Error("Placement not found or not visible to you.");
    if ((placement as any).locked) throw new Error("This placement is locked and can no longer be reassigned.");

    const { data: allowed } = await (supabase.rpc as any)("ct_can_access_department", {
      _department_id: (placement as any).department_id,
    });
    if (allowed === false) throw new Error("You cannot manage placements for this department.");

    if (data.trainer_registry_id) {
      const pool = await listDepartmentTrainers<any>(
        supabase,
        (placement as any).department_id,
        "id, full_name",
      );
      if (!pool.some((t) => t.id === data.trainer_registry_id)) {
        throw new Error("That trainer does not belong to this placement's department.");
      }
    }

    const { error } = await supabase
      .from("ct_student_placements")
      .update({ visiting_trainer_id: data.trainer_registry_id, updated_by: userId })
      .eq("id", data.placement_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
