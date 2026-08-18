import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Recurring skill gap tags per department. RLS already scopes the placements a
 * caller may read, so the aggregation is naturally department-isolated.
 */
export const listCtGapAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: placements }, { data: gaps }, { data: departments }] = await Promise.all([
      supabase.from("ct_student_placements").select("id, department_id, student_id").limit(1000),
      (supabase.from("ct_skill_gaps" as any) as any)
        .select("id, placement_id, tag, detail, competency, gap_type, severity, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("departments").select("id, name"),
    ]);
    const deptByPlacement = new Map<string, string | null>(
      (placements ?? []).map((p: any) => [p.id, p.department_id ?? null]),
    );
    const studentByPlacement = new Map<string, string | null>(
      (placements ?? []).map((p: any) => [p.id, p.student_id ?? null]),
    );
    const rows = new Map<
      string,
      { department_id: string | null; tag: string; count: number; severity: string; trainees: Set<string> }
    >();
    for (const g of (gaps ?? []) as any[]) {
      const tag = (g.tag || g.competency || g.detail || g.gap_type || "Unspecified").toString().trim();
      const dept = deptByPlacement.get(g.placement_id) ?? null;
      const key = `${dept ?? "-"}::${tag.toLowerCase()}`;
      const existing = rows.get(key) ?? {
        department_id: dept,
        tag,
        count: 0,
        severity: g.severity ?? "MEDIUM",
        trainees: new Set<string>(),
      };
      existing.count += 1;
      const student = studentByPlacement.get(g.placement_id);
      if (student) existing.trainees.add(student);
      if (g.severity === "CRITICAL" || (g.severity === "HIGH" && existing.severity !== "CRITICAL")) {
        existing.severity = g.severity;
      }
      rows.set(key, existing);
    }
    return {
      departments: (departments ?? []) as any[],
      gaps: Array.from(rows.values())
        .map((r) => ({ ...r, trainees: r.trainees.size }))
        .sort((a, b) => b.count - a.count),
    };
  });
