import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs, getAuditFacets, exportAuditLogs } from "@/lib/audit.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, RotateCcw, Search, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/audit")({
  component: AuditLogsPage,
});

const ANY = "__any__";

type LogRow = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  before_state: unknown;
  after_state: unknown;
  timestamp: string;
  ip_address: string | null;
  device_info: string | null;
};

function actionTone(action: string) {
  const a = action.toUpperCase();
  if (a.includes("DELETE") || a.includes("WIPE") || a.includes("REJECT")) return "bg-rose/15 text-rose border-rose/30";
  if (a.includes("APPROVE") || a.includes("PUBLISH")) return "bg-teal/15 text-teal border-teal/40";
  if (a.includes("CREATE") || a.includes("INSERT") || a.includes("IMPORT")) return "bg-emerald/15 text-emerald border-emerald/30";
  if (a.includes("UPDATE") || a.includes("SET") || a.includes("SWAP")) return "bg-stat-blue/15 text-stat-blue border-stat-blue/30";
  if (a.includes("OVERRIDE") || a.includes("PASSWORD") || a.includes("RESET")) return "bg-amber/20 text-amber-fg border-amber/40";
  return "bg-muted text-muted-foreground border-border";
}

function toCSV(rows: LogRow[]) {
  const head = [
    "Timestamp (ISO)", "Actor", "Actor email", "Actor ID", "Action",
    "Entity type", "Entity ID", "Before state", "After state", "IP address", "Device",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    head.map(esc).join(","),
    ...rows.map((r) =>
      [r.timestamp, r.actor_name, r.actor_email, r.actor_id, r.action_type, r.entity_type,
        r.entity_id, r.before_state, r.after_state, r.ip_address, r.device_info].map(esc).join(","),
    ),
  ].join("\n");
}

function AuditLogsPage() {
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listAuditLogs);
  const facetsFn = useServerFn(getAuditFacets);
  const exportFn = useServerFn(exportAuditLogs);

  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [actionType, setActionType] = useState(ANY);
  const [entityType, setEntityType] = useState(ANY);
  const [actorId, setActorId] = useState(ANY);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detail, setDetail] = useState<LogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      action_type: actionType === ANY ? undefined : actionType,
      entity_type: entityType === ANY ? undefined : entityType,
      actor_id: actorId === ANY ? undefined : actorId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    }),
    [search, actionType, entityType, actorId, dateFrom, dateTo, page, pageSize],
  );

  const enabled = authReady && hasSession;
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => list({ data: filters }),
    enabled,
    throwOnError: false,
    placeholderData: (prev) => prev,
  });
  const { data: facets } = useQuery({
    queryKey: ["audit-facets"],
    queryFn: () => facetsFn(),
    enabled,
    throwOnError: false,
    staleTime: 60_000,
  });

  const rows = (data?.rows ?? []) as LogRow[];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const resetFilters = () => {
    setSearch(""); setSearchDraft(""); setActionType(ANY); setEntityType(ANY);
    setActorId(ANY); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await exportFn({ data: { ...filters, page: 1, page_size: 50 } });
      const csv = toCSV(res.rows as LogRow[]);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.rows.length} audit entries`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader><CardTitle>Audit trail unavailable</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{(error as Error).message.includes("Forbidden")
            ? "Only Master Admins can view the audit trail."
            : (error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Append-only record of every privileged action — who did what, to which record, and when.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-teal/40 bg-teal/10 text-teal">
            <Lock className="h-3 w-3" /> Immutable
          </Badge>
          <Button size="sm" variant="outline" onClick={doExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Entries (all time)", value: total },
          { label: "Last 24 hours", value: facets?.last24h ?? 0 },
          { label: "Last 7 days", value: facets?.last7d ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-xs">Search</Label>
            <div className="flex gap-2">
              <Input
                value={searchDraft}
                placeholder="Action, entity or record ID"
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); setSearch(searchDraft); } }}
              />
              <Button variant="secondary" size="icon" onClick={() => { setPage(1); setSearch(searchDraft); }}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Action</Label>
            <Select value={actionType} onValueChange={(v) => { setPage(1); setActionType(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All actions</SelectItem>
                {(facets?.actions ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entity</Label>
            <Select value={entityType} onValueChange={(v) => { setPage(1); setEntityType(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All entities</SelectItem>
                {(facets?.entities ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Actor</Label>
            <Select value={actorId} onValueChange={(v) => { setPage(1); setActorId(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All users</SelectItem>
                {(facets?.actors ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Loading audit trail…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No audit entries match these filters.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">
                    {new Date(r.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.actor_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.actor_email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-md border text-[10px] font-semibold ${actionTone(r.action_type)}`}>
                      {r.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{r.entity_type}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">
                    {r.entity_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total === 0 ? "No entries" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          {isFetching && " · refreshing…"}
        </span>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPage(1); setPageSize(Number(v)); }}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="tabular-nums">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Audit entry</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["Timestamp", new Date(detail.timestamp).toLocaleString()],
                  ["Actor", `${detail.actor_name} (${detail.actor_email})`],
                  ["Action", detail.action_type],
                  ["Entity", detail.entity_type],
                  ["Record ID", detail.entity_id ?? "—"],
                  ["Entry ID", detail.id],
                  ["IP address", detail.ip_address ?? "—"],
                  ["Device", detail.device_info ?? "—"],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="break-all font-medium">{v as string}</dd>
                  </div>
                ))}
              </dl>
              {(["before_state", "after_state"] as const).map((k) => (
                <div key={k}>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {k === "before_state" ? "Before" : "After"}
                  </p>
                  <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-[11px]">
                    {detail[k] ? JSON.stringify(detail[k], null, 2) : "—"}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
