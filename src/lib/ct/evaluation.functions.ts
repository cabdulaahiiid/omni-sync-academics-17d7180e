import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export const listCtEvaluations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: evaluations }, { data: gaps }, { data: remedials }, { data: queue }] = await Promise.all([
      context.supabase
        .from("ct_final_evaluations")
        .select(
          "id, placement_id, source, evaluator_name, overall_comment, failed_uc_count, red_competency_count, remedial_hours, recommendation, finalized, finalized_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      context.supabase.from("ct_skill_gaps").select("id, placement_id, evaluation_id, uc_id, competency, gap_type, detail").limit(500),
      context.supabase.from("ct_remedial_actions").select("id, placement_id, evaluation_id, description, hours, completed").limit(300),
      context.supabase
        .from("ct_assessment_queue")
        .select("id, placement_id, evaluation_id, student_id, occupation_id, status, created_at, students(full_name, registration_number), ct_occupations(name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const evalIds = (evaluations ?? []).map((e) => e.id);
    const [{ data: ucResults }, { data: competencies }] = await Promise.all([
      evalIds.length
        ? context.supabase
            .from("ct_uc_evaluations")
            .select("id, evaluation_id, uc_id, result, comment, ct_units_of_competence(name)")
            .in("evaluation_id", evalIds)
        : Promise.resolve({ data: [] as any[] }),
      evalIds.length
        ? context.supabase
            .from("ct_basic_competency_evaluations")
            .select("id, evaluation_id, competency, rating, comment")
            .in("evaluation_id", evalIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return {
      evaluations: (evaluations ?? []) as any[],
      ucResults: (ucResults ?? []) as any[],
      competencies: (competencies ?? []) as any[],
      gaps: (gaps ?? []) as any[],
      remedials: (remedials ?? []) as any[],
      queue: (queue ?? []) as any[],
    };
  });

const submitSchema = z.object({
  placement_id: z.string().uuid(),
  source: z.enum(["TRAINER", "MENTOR"]),
  comment: z.string().trim().max(2000).optional().nullable(),
  uc_results: z
    .array(
      z.object({
        uc_id: z.string().uuid(),
        result: z.enum(["P", "NP"]),
        comment: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1, "Rate at least one unit of competence"),
  competencies: z
    .array(
      z.object({
        competency: z.string().trim().min(2).max(120),
        rating: z.enum(["GREEN", "YELLOW", "RED"]),
        comment: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .default([]),
});

export const submitCtEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await (context.supabase.rpc as any)("ct_submit_evaluation", {
      _placement_id: data.placement_id,
      _source: data.source,
      _uc_results: data.uc_results as any,
      _competencies: data.competencies as any,
      _comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });

export const finalizeCtEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ evaluation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "VT", "T", "CO"], "finalizeCtEvaluation");
    const { data: res, error } = await (context.supabase.rpc as any)("ct_finalize_evaluation", {
      _evaluation_id: data.evaluation_id,
    });
    if (error) throw new Error(error.message);
    return res as unknown as {
      failed_uc_count: number;
      red_competency_count: number;
      remedial_hours: number;
      recommendation: string;
    };
  });

export const pushCtToAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ evaluation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "CO"], "pushCtToAssessment");
    const { data: id, error } = await (context.supabase.rpc as any)("ct_push_to_assessment", {
      _evaluation_id: data.evaluation_id,
    });
    if (error) throw new Error(error.message);
    return { id: id as unknown as string };
  });
