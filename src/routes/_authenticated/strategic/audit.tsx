import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiTile } from "@/components/erp/kpi-tile";
import { EmptyState } from "@/components/erp/empty-state";
import { ActivityRow } from "@/components/erp/activity-row";
import { ShieldCheck, Activity, Users, Search, X, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategic/audit")({
  component: AuditLogsPage,
});

const RANGE_HOURS: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

function AuditLogsPage() {
  const [range, setRange] = useState<keyof typeof RANGE_HOURS>("7d");
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data: rows, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["ma-audit-logs", range, limit],
    queryFn: async () => {
      const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action_type, entity_type, entity_id, actor_id, timestamp")
        .gte("timestamp", since)
        .order("timestamp", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 15_000,
  });

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r: any) => r.action_type && set.add(r.action_type));
    return Array.from(set).sort();
  }, [rows]);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    (rows ?? []).forEach((r: any) => r.entity_type && set.add(r.entity_type));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r: any) => {
      if (actionFilter !== "all" && r.action_type !== actionFilter) return false;
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (q) {
        const blob = `${r.entity_id ?? ""} ${r.actor_id ?? ""} ${r.entity_type ?? ""} ${r.action_type ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, actionFilter, entityFilter]);

  const kpis = useMemo(() => {
    const list = rows ?? [];
    const now = Date.now();
    const last24 = list.filter((r: any) => now - new Date(r.timestamp).getTime() <= 24 * 3600 * 1000);
    const last7 = list.filter((r: any) => now - new Date(r.timestamp).getTime() <= 7 * 24 * 3600 * 1000);
    const actors = new Set(last7.map((r: any) => r.actor_id).filter(Boolean)).size;
    const counts: Record<string, number> = {};
    last7.forEach((r: any) => { if (r.action_type) counts[r.action_type] = (counts[r.action_type] ?? 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return {
      day: last24.length,
      week: last7.length,
      actors,
      topLabel: top ? `${top[0]} · ${top[1]}` : "—",
    };
  }, [rows]);

  function resetFilters() {
    setSearch(""); setActionFilter("all"); setEntityFilter("all");
  }

  function shortId(id: string | null) {
    if (!id) return "system";
    return id.length > 8 ? `${id.slice(0, 8)}…` : id;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Append-only record of every privileged action across the institution.</p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(RANGE_HOURS) as Array<keyof typeof RANGE_HOURS>).map((k) => (
            <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => { setRange(k); setLimit(100); }}>
              {k}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Events (24h)" value={kpis.day} icon={Activity} tone="blue" />
        <KpiTile label="Events (7d)" value={kpis.week} icon={ShieldCheck} tone="green" />
        <KpiTile label="Distinct Actors (7d)" value={kpis.actors} icon={Users} tone="purple" />
        <KpiTile label="Top Action (7d)" value={kpis.topLabel} icon={Activity} tone="orange" />
      </div>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entity / actor id"
                className="pl-8"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entityOptions.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length.toLocaleString()} of {(rows ?? []).length.toLocaleString()} loaded · window {range}</span>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-3 w-3" /> Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity feed</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No audit events match these filters"
              description="Adjust the time window or clear filters to see more activity."
            />
          ) : (
            <ul className="ml-1 space-y-0 border-l border-border/60">
              {filtered.map((r: any) => (
                <ActivityRow
                  key={r.id}
                  action={r.action_type ?? "UNKNOWN"}
                  entity={r.entity_type}
                  detail={`${r.entity_id ? `#${shortId(r.entity_id)}` : ""}${r.actor_id ? ` · by ${shortId(r.actor_id)}` : ""}`}
                  timestamp={r.timestamp}
                />
              ))}
            </ul>
          )}
          {(rows?.length ?? 0) >= limit && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + 50)} disabled={isFetching}>
                Load 50 more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[11px] text-muted-foreground">
        Audit logs are immutable by policy. To investigate a specific user, paste their ID into the search box above.
      </p>
    </div>
  );
}

// silence unused-import lint in case Badge isn't referenced in this file later
void Badge;
