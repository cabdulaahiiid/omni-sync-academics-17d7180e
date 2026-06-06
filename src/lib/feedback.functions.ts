import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** MA: reject a semester and open/append a feedback thread. */
export const maRejectSemesterWithFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid(),
      message: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: threadId, error } = await context.supabase.rpc(
      "ma_reject_semester_with_feedback",
      { _semester_id: data.semester_id, _message: data.message },
    );
    if (error) throw new Error(error.message);
    return { thread_id: threadId as string };
  });

/** DH or MA: post a reply to an open feedback thread. */
export const replyFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      thread_id: z.string().uuid(),
      message: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dh_reply_feedback", {
      _thread_id: data.thread_id,
      _message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** DH: resubmit a semester back to PENDING_MA. */
export const dhResubmitSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("dh_resubmit_semester", {
      _semester_id: data.semester_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Find a feedback thread by semester. Returns null if none. */
export const getThreadForSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid(),
      week_num: z.number().int().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("schedule_feedback_threads")
      .select("id, semester_id, department_id, admin_id, dh_id, week_num, created_at")
      .eq("semester_id", data.semester_id);
    q = data.week_num == null ? q.is("week_num", null) : q.eq("week_num", data.week_num);
    const { data: thread } = await q.maybeSingle();
    if (!thread) return { thread: null, messages: [] as MessageRow[] };
    const { data: messages } = await context.supabase
      .from("schedule_feedback_messages")
      .select("id, thread_id, sender_id, message, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    return { thread, messages: (messages ?? []) as MessageRow[] };
  });

/** DH: list per-week feedback threads in their department. */
export const listWeekThreadsForDept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ department_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: threads, error } = await context.supabase
      .from("schedule_feedback_threads")
      .select("id, semester_id, week_num, created_at")
      .eq("department_id", data.department_id)
      .not("week_num", "is", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const semIds = Array.from(new Set((threads ?? []).map((t) => t.semester_id)));
    let sems: Record<string, { name: string }> = {};
    if (semIds.length) {
      const { data: rs } = await context.supabase
        .from("semester_registry")
        .select("id, name")
        .in("id", semIds);
      sems = Object.fromEntries((rs ?? []).map((r) => [r.id, { name: r.name }]));
    }
    return (threads ?? []).map((t) => ({ ...t, semester_name: sems[t.semester_id]?.name ?? "Semester" }));
  });

/** DH: resubmit a single week back to PENDING_MA. */
export const dhResubmitWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid(), week_num: z.number().int() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc("dh_resubmit_week", {
      _semester_id: data.semester_id,
      _week_num: data.week_num,
    });
    if (error) throw new Error(error.message);
    return { count: (count as number) ?? 0 };
  });

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  message: string;
  created_at: string;
};