import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Pencil, Check, X } from "lucide-react";
import { listLevelsByDepartment, updateLevel } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/strategic/levels")({
  component: LevelsPage,
});

function LevelsPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listLevelsByDepartment);
  const upd = useServerFn(updateLevel);
  const { data, isLoading } = useQuery({
    queryKey: ["levels-by-dept"],
    queryFn: () => list(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });

  const [filter, setFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mut = useMutation({
    mutationFn: (v: { id: string; display_name?: string | null; status?: "ACTIVE" | "SUSPENDED" }) =>
      upd({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["levels-by-dept"] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = useMemo(
    () => (filter === "all" ? data ?? [] : (data ?? []).filter((d) => d.id === filter)),
    [filter, data],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Levels</h1>
        <p className="text-sm text-muted-foreground">
          Levels are provisioned automatically (I–V) for every department. Rename or disable as needed.
        </p>
      </div>
      <Card className="bg-muted/40">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            When you create a new department, the system auto-generates 5 academic levels
            (I, II, III, IV, V). You can rename them (e.g. "Year 1") or mark inactive ones as suspended.
          </span>
        </CardContent>
      </Card>
      <div className="w-64">
        <Label className="text-xs text-muted-foreground">Filter by department</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {data?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{d.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.levels.length === 0 ? (
                <span className="text-sm text-muted-foreground">No levels.</span>
              ) : (
                d.levels.map((l: any) => {
                  const isEditing = editingId === l.id;
                  const active = l.status !== "SUSPENDED";
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isEditing ? (
                          <>
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder={`Level ${l.name}`}
                              className="h-8"
                              maxLength={60}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => mut.mutate({ id: l.id, display_name: editValue.trim() || null })}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">Level {l.display_name || l.name}</Badge>
                            {l.display_name && <span className="text-xs text-muted-foreground">({l.name})</span>}
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => { setEditingId(l.id); setEditValue(l.display_name || ""); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{active ? "Active" : "Suspended"}</span>
                        <Switch
                          checked={active}
                          onCheckedChange={(v) => mut.mutate({ id: l.id, status: v ? "ACTIVE" : "SUSPENDED" })}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No departments yet. Create one in the Departments tab.</p>
        )}
      </div>
    </div>
  );
}