import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_active_drafts",
  title: "List active schedule drafts",
  description:
    "List draft schedule sessions visible to the signed-in user. Department Heads see only their department; Master Admins see all departments. Returns per-semester, per-week draft/pending/published counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("DH") && !roles.includes("MA")) {
      return {
        content: [{ type: "text", text: "This tool requires the DH or MA role." }],
        isError: true,
      };
    }

    let departmentId: string | null = null;
    if (!roles.includes("MA")) {
      const { data: prof } = await sb
        .from("profiles")
        .select("department_id")
        .eq("id", userId)
        .maybeSingle();
      departmentId = prof?.department_id ?? null;
      if (!departmentId) {
        return {
          content: [{ type: "text", text: "No department assigned to this account." }],
          isError: true,
        };
      }
    }

    const { data: sems, error: semErr } = await sb
      .from("semester_registry")
      .select("id, name, start_date, end_date, status")
      .order("start_date", { ascending: false });
    if (semErr) {
      return { content: [{ type: "text", text: semErr.message }], isError: true };
    }
    const ids = (sems ?? []).map((s) => s.id);
    if (!ids.length) {
      return {
        content: [{ type: "text", text: "No semesters found." }],
        structuredContent: { semesters: [] },
      };
    }

    let q = sb
      .from("schedules")
      .select("semester_id, week_num, status, is_published")
      .in("semester_id", ids)
      .neq("status", "CANCELLED");
    if (departmentId) q = q.eq("department_id", departmentId);
    const { data: rows, error: rowsErr } = await q;
    if (rowsErr) {
      return { content: [{ type: "text", text: rowsErr.message }], isError: true };
    }

    const byId = new Map<string, Record<number, { draft: number; pending: number; published: number }>>();
    for (const r of rows ?? []) {
      if (!r.semester_id || r.week_num == null) continue;
      const m = byId.get(r.semester_id) ?? {};
      const w = m[r.week_num] ?? { draft: 0, pending: 0, published: 0 };
      if (r.status === "DRAFT" && !r.is_published) w.draft += 1;
      if (r.status === "PENDING_MA") w.pending += 1;
      if (r.is_published) w.published += 1;
      m[r.week_num] = w;
      byId.set(r.semester_id, m);
    }

    const semesters = (sems ?? [])
      .map((s) => {
        const weeks = Object.entries(byId.get(s.id) ?? {})
          .map(([k, v]) => ({ week_num: Number(k), ...v }))
          .filter((w) => w.draft > 0 || w.pending > 0 || w.published > 0)
          .sort((a, b) => a.week_num - b.week_num);
        return { ...s, weeks };
      })
      .filter((s) => s.weeks.length > 0);

    return {
      content: [{ type: "text", text: JSON.stringify({ semesters }, null, 2) }],
      structuredContent: { semesters },
    };
  },
});