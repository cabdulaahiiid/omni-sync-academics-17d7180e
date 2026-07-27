import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

const filterSchema = z.object({
  search: z.string().max(200).optional(),
  action_type: z.string().max(80).optional(),
  entity_type: z.string().max(80).optional(),
  actor_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.number().int().min(1).max(500).default(1),
  page_size: z.number().int().min(10).max(200).default(50),
});

export type AuditFilters = z.infer<typeof filterSchema>;

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

type Row = {
  id: string;
  actor_id: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Json;
  after_state: Json;
  timestamp: string;
  ip_address: string | null;
  device_info: string | null;
};

function applyFilters<T>(q: T, f: AuditFilters): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let b: any = q;
  if (f.action_type) b = b.eq("action_type", f.action_type);
  if (f.entity_type) b = b.eq("entity_type", f.entity_type);
  if (f.actor_id) b = b.eq("actor_id", f.actor_id);
  if (f.date_from) b = b.gte("timestamp", new Date(f.date_from).toISOString());
  if (f.date_to) {
    const to = new Date(f.date_to);
    to.setHours(23, 59, 59, 999);
    b = b.lte("timestamp", to.toISOString());
  }
  if (f.search && f.search.trim()) {
    const s = f.search.trim().replace(/[%,]/g, " ");
    b = b.or(
      `action_type.ilike.%${s}%,entity_type.ilike.%${s}%,entity_id.ilike.%${s}%`,
    );
  }
  return b as T;
}

async function decorate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Row[],
) {
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const map = new Map<string, { name: string; email: string }>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of data ?? []) map.set(p.id, { name: p.full_name || p.email, email: p.email });
  }
  return rows.map((r) => ({
    ...r,
    actor_name: r.actor_id ? (map.get(r.actor_id)?.name ?? "Deleted user") : "System",
    actor_email: r.actor_id ? (map.get(r.actor_id)?.email ?? "—") : "—",
  }));
}

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "listAuditLogs");
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let query = context.supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range(from, to);
    query = applyFilters(query, data);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return {
      rows: await decorate(context.supabase, (rows ?? []) as Row[]),
      total: count ?? 0,
      page: data.page,
      page_size: data.page_size,
    };
  });

/** Distinct filter values + 24h/7d activity counters. */
export const getAuditFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "getAuditFacets");
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("action_type, entity_type, actor_id, timestamp")
      .order("timestamp", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const actions = [...new Set(rows.map((r) => r.action_type))].sort();
    const entities = [...new Set(rows.map((r) => r.entity_type))].sort();
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
    const actors: { id: string; name: string }[] = [];
    if (actorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles").select("id, full_name, email").in("id", actorIds);
      for (const p of profs ?? []) actors.push({ id: p.id, name: p.full_name || p.email });
      actors.sort((a, b) => a.name.localeCompare(b.name));
    }
    const now = Date.now();
    const last24h = rows.filter((r) => now - new Date(r.timestamp).getTime() < 864e5).length;
    const last7d = rows.filter((r) => now - new Date(r.timestamp).getTime() < 6048e5).length;
    return { actions, entities, actors, last24h, last7d, sampled: rows.length };
  });

/** Full filtered export (capped) for compliance archiving. */
export const exportAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "exportAuditLogs");
    let query = context.supabase
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(10000);
    query = applyFilters(query, data);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const decorated = await decorate(context.supabase, (rows ?? []) as Row[]);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "EXPORT",
      entity_type: "audit_logs",
      after_state: { rows: decorated.length, filters: data },
    });
    return { rows: decorated };
  });