import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = (d: unknown) => z.object({ request_id: z.string().uuid() }).parse(d);
const decisionInput = (d: unknown) =>
  z
    .object({
      request_id: z.string().uuid(),
      decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
      comment: z.string().trim().max(1000).optional().nullable(),
    })
    .parse(d);

/**
 * Requests visible to the caller. RLS decides the scope: IPS sees everything,
 * the Program Director only sees delegated requests, the Industrial DH only
 * sees its own department.
 */
export const listCtWorkflowQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: requests, error } = await supabase
      .from("ct_training_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (requests ?? []).map((r: any) => r.id);
    const [{ data: members }, { data: decisions }, { data: departments }] = await Promise.all([
      ids.length
        ? supabase
            .from("ct_training_request_students")
            .select("request_id, student_id, theory_percent, eligible, manual_override, override_reason, students(full_name, registration_number)")
            .in("request_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? (supabase.from("ct_request_decisions" as any) as any)
            .select("id, request_id, action, actor_role, previous_status, new_status, comment, created_at")
            .in("request_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("departments").select("id, name"),
    ]);

    return {
      requests: (requests ?? []) as any[],
      members: (members ?? []) as any[],
      decisions: (decisions ?? []) as any[],
      departments: (departments ?? []) as any[],
    };
  });

export const ipsStartReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_ips_start_review", { _request_id: data.request_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ipsDecideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(decisionInput)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_ips_decide_request", {
      _request_id: data.request_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ipsDelegateToPd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
        note: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_ips_delegate_request", {
      _request_id: data.request_id,
      _to_user: data.to_user_id,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pdStartReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_pd_start_review", { _request_id: data.request_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pdDecideRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(decisionInput)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_pd_decide_request", {
      _request_id: data.request_id,
      _decision: data.decision,
      _comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pdReturnBatchToIps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        request_ids: z.array(z.string().uuid()).min(1),
        note: z.string().trim().min(3, "Explain what the supervisor should look at.").max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)("ct_pd_bulk_return_to_ips", {
      _request_ids: data.request_ids,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Program Directors the supervisor can delegate a request to. */
export const listProgramDirectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "PD" as any);
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    if (!ids.length) return [] as { id: string; full_name: string | null; email: string | null }[];
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    return (profiles ?? []) as any[];
  });
