import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { toastError } from "@/lib/errors/toast";
import { getModulePracticalTemplate, saveModulePracticalTemplate } from "@/lib/practical-template.functions";
import {
  PracticalSessionEditor,
  toDrafts,
  type PracticalSessionDraft,
} from "@/components/practical/practical-session-editor";

/** Admin master template of practical sessions / sub-sessions for one module. */
export function ModulePracticalTemplateDialog({
  module_,
  open,
  onOpenChange,
}: {
  module_: { id: string; code: string; name: string; type: string } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getModulePracticalTemplate);
  const save = useServerFn(saveModulePracticalTemplate);
  const [sessions, setSessions] = useState<PracticalSessionDraft[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["module-practical-template", module_?.id],
    queryFn: () => load({ data: { module_id: module_!.id } }),
    enabled: open && !!module_?.id,
  });

  useEffect(() => {
    if (data) setSessions(toDrafts(data.sessions));
  }, [data]);

  const isTheory = module_?.type === "Theory";
  const totalHours = sessions.reduce((sum, s) => sum + (Number(s.allocated_hours) || 0), 0);
  const totalTasks = sessions.reduce((sum, s) => sum + s.tasks.length, 0);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          module_id: module_!.id,
          sessions: sessions.map((s) => ({
            name: s.name.trim(),
            allocated_hours: Number(s.allocated_hours) || 0,
            venue_hint: s.venue_hint.trim() || null,
            active: s.active,
            tasks: s.tasks.map((t) => ({
              title: t.title.trim(),
              competency_code: t.competency_code.trim() || null,
              description: t.description.trim() || null,
              active: t.active,
            })),
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`Practical template saved — ${r.sessions} session(s), ${r.tasks} sub-session(s).`);
      qc.invalidateQueries({ queryKey: ["module-practical-template", module_?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toastError(e),
  });

  const invalid =
    sessions.some((s) => s.name.trim().length < 2) ||
    sessions.some((s) => s.tasks.some((t) => t.title.trim().length < 2));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Practical template
            {module_ && (
              <span className="text-sm font-normal text-muted-foreground">
                {module_.code} · {module_.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isTheory ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            This module is delivered as Theory only, so it has no practical sessions. Change its type to
            Practical or Both to define a practical template.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{sessions.length} session(s)</Badge>
              <Badge variant="outline">{totalTasks} sub-session(s)</Badge>
              <Badge variant="outline">{totalHours} allocated hour(s)</Badge>
              <span className="text-muted-foreground">
                Department Heads pre-fill their schedule from this list.
              </span>
            </div>
            <div className="-mx-1 flex-1 overflow-y-auto px-1 py-1">
              {isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading template…</p>
              ) : (
                <PracticalSessionEditor value={sessions} onChange={setSessions} />
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!isTheory && (
            <Button onClick={() => saveMut.mutate()} disabled={invalid || saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
