import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side data consistency validator. Compares aggregates that the UI
 * surfaces to actual row counts and flags drift. MA-only.
 */
export const runConsistencyCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isMA } = await supabase.rpc("has_role", { _user_id: userId, _role: "MA" });
    if (!isMA) throw new Error("Master Admin only");

    const checks: { name: string; expected: number | string; actual: number | string; ok: boolean; detail?: string }[] = [];

    // 1. Students per department vs schedules.section_id departments
    const [{ count: studentCount }, { count: pendingApprovals }, { data: schedNoTrainer }, { data: schedNoVenue }, { data: schedNoModule }, { data: deptStudents }, { data: depts }] = await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
      supabase.from("approval_queue").select("*", { count: "exact", head: true }).eq("decision", "pending"),
      supabase.from("schedules").select("id").is("trainer_registry_id", null).limit(500),
      supabase.from("schedules").select("id").is("venue_id", null).limit(500),
      supabase.from("schedules").select("id").is("module_id", null).limit(500),
      supabase.from("students").select("department_id").eq("status", "ACTIVE").limit(50000),
      supabase.from("departments").select("id, name"),
    ]);

    const byDept = new Map<string, number>();
    for (const s of deptStudents ?? []) {
      byDept.set(s.department_id, (byDept.get(s.department_id) ?? 0) + 1);
    }
    const totalByDept = Array.from(byDept.values()).reduce((a, b) => a + b, 0);
    checks.push({
      name: "Active students = sum of per-department active students",
      expected: studentCount ?? 0,
      actual: totalByDept,
      ok: (studentCount ?? 0) === totalByDept,
    });

    checks.push({
      name: "Schedules with no trainer assigned",
      expected: 0,
      actual: (schedNoTrainer ?? []).length,
      ok: (schedNoTrainer ?? []).length === 0,
    });
    checks.push({
      name: "Schedules with no venue assigned",
      expected: 0,
      actual: (schedNoVenue ?? []).length,
      ok: (schedNoVenue ?? []).length === 0,
    });
    checks.push({
      name: "Schedules with no module assigned",
      expected: 0,
      actual: (schedNoModule ?? []).length,
      ok: (schedNoModule ?? []).length === 0,
    });

    // Orphans: attendance rows pointing at deleted schedules
    const { data: orphAtt } = await supabase
      .from("attendance_logs")
      .select("schedule_id, schedules(id)")
      .is("schedules.id", null)
      .limit(500);
    checks.push({
      name: "Orphaned attendance_logs (schedule deleted)",
      expected: 0,
      actual: (orphAtt ?? []).length,
      ok: (orphAtt ?? []).length === 0,
    });

    checks.push({
      name: "Pending approvals (informational)",
      expected: "—",
      actual: pendingApprovals ?? 0,
      ok: true,
    });

    // Persist a single audit entry summarising drift
    const drift = checks.filter((c) => !c.ok).length;
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action_type: "CONSISTENCY_CHECK",
      entity_type: "system",
      entity_id: "consistency",
      after_state: { drift, checked: checks.length, failures: checks.filter((c) => !c.ok).map((c) => c.name) },
    });

    return {
      generated_at: new Date().toISOString(),
      drift,
      checks,
      departments: depts ?? [],
    };
  });
