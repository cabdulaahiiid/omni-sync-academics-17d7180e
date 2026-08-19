import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

export type PracticalTaskDraft = {
  title: string;
  competency_code: string;
  description: string;
  active: boolean;
};

export type PracticalSessionDraft = {
  name: string;
  allocated_hours: number;
  venue_hint: string;
  active: boolean;
  tasks: PracticalTaskDraft[];
};

export function emptyTask(): PracticalTaskDraft {
  return { title: "", competency_code: "", description: "", active: true };
}

export function emptySession(): PracticalSessionDraft {
  return { name: "", allocated_hours: 0, venue_hint: "", active: true, tasks: [] };
}

/** Normalize whatever the server returned into editable drafts. */
export function toDrafts(rows: any[] | undefined | null): PracticalSessionDraft[] {
  return (rows ?? []).map((s) => ({
    name: s.name ?? "",
    allocated_hours: Number(s.allocated_hours ?? 0),
    venue_hint: s.venue_hint ?? "",
    active: s.active ?? true,
    tasks: (s.tasks ?? []).map((t: any) => ({
      title: t.title ?? "",
      competency_code: t.competency_code ?? "",
      description: t.description ?? "",
      active: t.active ?? true,
    })),
  }));
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Nested editor for practical sessions and their sub-sessions (tasks).
 * Shared by the Admin module master template and the DH Schedule Builder.
 */
export function PracticalSessionEditor({
  value,
  onChange,
  showActive = true,
  className,
}: {
  value: PracticalSessionDraft[];
  onChange: (next: PracticalSessionDraft[]) => void;
  /** Master template can deactivate rows; a plan copy simply removes them. */
  showActive?: boolean;
  className?: string;
}) {
  const patch = (i: number, p: Partial<PracticalSessionDraft>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const patchTask = (i: number, j: number, p: Partial<PracticalTaskDraft>) =>
    patch(i, { tasks: value[i].tasks.map((t, idx) => (idx === j ? { ...t, ...p } : t)) });

  return (
    <div className={cn("space-y-3", className)}>
      {value.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
          <ListTree className="h-4 w-4" />
          No practical sessions yet. Add the first one below.
        </div>
      )}

      {value.map((s, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Session {i + 1}
            </span>
            <div className="flex items-center gap-1">
              {showActive && (
                <label className="mr-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Switch checked={s.active} onCheckedChange={(v) => patch(i, { active: v })} />
                  Active
                </label>
              )}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                aria-label="Move session up" onClick={() => onChange(move(value, i, i - 1))}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                aria-label="Move session down" onClick={() => onChange(move(value, i, i + 1))}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                aria-label="Remove session" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr]">
            <div className="space-y-1">
              <Label className="text-xs">Session name</Label>
              <Input value={s.name} placeholder="e.g. Server installation practice"
                onChange={(e) => patch(i, { name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Allocated hours</Label>
              <Input type="number" min={0} step="0.5" value={s.allocated_hours}
                onChange={(e) => patch(i, { allocated_hours: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Venue</Label>
              <Input value={s.venue_hint} placeholder="e.g. Network Lab"
                onChange={(e) => patch(i, { venue_hint: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-background/60 p-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-sessions / practical tasks
            </div>
            {s.tasks.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No tasks yet.</p>
            )}
            {s.tasks.map((t, j) => (
              <div key={j} className="space-y-2 rounded-lg border p-2">
                <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Task title</Label>
                    <Input value={t.title} placeholder="e.g. Configure DHCP scope"
                      onChange={(e) => patchTask(i, j, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Competency code</Label>
                    <Input value={t.competency_code} placeholder="e.g. ICT-NET-03"
                      onChange={(e) => patchTask(i, j, { competency_code: e.target.value })} />
                  </div>
                  <div className="flex items-end gap-1 pb-0.5">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                      aria-label="Move task up"
                      onClick={() => patch(i, { tasks: move(s.tasks, j, j - 1) })}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                      aria-label="Move task down"
                      onClick={() => patch(i, { tasks: move(s.tasks, j, j + 1) })}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      aria-label="Remove task"
                      onClick={() => patch(i, { tasks: s.tasks.filter((_, idx) => idx !== j) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Practical description</Label>
                  <Textarea rows={2} value={t.description}
                    placeholder="What the trainee must perform and how it is verified."
                    onChange={(e) => patchTask(i, j, { description: e.target.value })} />
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline"
              onClick={() => patch(i, { tasks: [...s.tasks, emptyTask()] })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add sub-session
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...value, emptySession()])}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add practical session
      </Button>
    </div>
  );
}
