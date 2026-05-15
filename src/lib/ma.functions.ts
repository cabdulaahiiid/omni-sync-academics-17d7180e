import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listApprovalQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      type: z.enum(["semester", "session"]).optional(),
      decision: z.enum(["pending", "approved", "rejected"]).optional().default("pending"),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("approval_queue")
      .select("id, type, target_id, decision, comment, created_at, decided_at, submitted_by, schedule_id, conflict_trainer, conflict_venue, invalid_qualification, excessive_load")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.type) q = q.eq("type", data.type);
    if (data.decision) q = q.eq("decision", data.decision);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const sessionIds = (rows ?? [])
      .filter((r) => r.type === "session" && r.target_id)
      .map((r) => r.target_id as string);
    const semIds = (rows ?? [])
      .filter((r) => r.type === "semester" && r.target_id)
      .map((r) => r.target_id as string);

    const [{ data: scheds }, { data: sems }] = await Promise.all([
      sessionIds.length
        ? context.supabase.from("schedules")
            .select("id, module_code, module_name, date, start_time, end_time, trainer_name, status, department_id")
            .in("id", sessionIds)
        : Promise.resolve({ data: [] as any[] }),
      semIds.length
        ? context.supabase.from("semester_registry")
            .select("id, name, start_date, end_date, status").in("id", semIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const sMap = Object.fromEntries((scheds ?? []).map((s) => [s.id, s]));
    const semMap = Object.fromEntries((sems ?? []).map((s) => [s.id, s]));
    return (rows ?? []).map((r) => ({
      ...r,
      schedule: r.type === "session" ? sMap[r.target_id as string] : null,
      semester: r.type === "semester" ? semMap[r.target_id as string] : null,
    }));
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      comment: z.string().max(1000).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decide_approval", {
      _id: data.id,
      _decision: data.decision,
      _comment: data.comment,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      type: z.enum(["semester", "session"]),
      target_ids: z.array(z.string().uuid()).min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc("submit_for_approval", {
      _type: data.type,
      _target_ids: data.target_ids,
    });
    if (error) throw new Error(error.message);
    return { count };
  });

export const dashboardInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ count: live }, { count: pending }, { count: ended }, { count: trainers }] = await Promise.all([
      context.supabase.from("schedules").select("id", { count: "exact", head: true }).in("status", ["LIVE", "ACTIVE"]),
      context.supabase.from("approval_queue").select("id", { count: "exact", head: true }).eq("decision", "pending"),
      context.supabase.from("schedules").select("id", { count: "exact", head: true }).eq("status", "ENDED"),
      context.supabase.from("trainer_registry").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
    ]);
    return { live: live ?? 0, pending: pending ?? 0, ended: ended ?? 0, trainers: trainers ?? 0 };
  });
