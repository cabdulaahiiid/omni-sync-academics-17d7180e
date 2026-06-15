import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listSemesterDrafts, requestSemesterApproval, dhRequestApprovalPerWeek } from "@/lib/semester-drafts.functions";
import { listWeekThreadsForDept } from "@/lib/feedback.functions";
import { ApprovalVersionTimeline } from "@/components/approval-version-timeline";
import { WeekFeedbackWorkspace } from "@/components/week-feedback-workspace";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileClock, MessageSquareWarning, CalendarRange } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/operational/drafts")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({
      semester: z.string().uuid().optional(),
      week: z.coerce.number().int().optional(),
      chat: z.coerce.number().int().optional(),
    }).parse(s),
  component: DraftsPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  PENDING_MA: "destructive",
  FEEDBACK_ACTIVE: "destructive",
  PUBLISHED: "default",
};

function DraftsPage() {
  const { data: me } = useMe();
  const search = useSearch({ from: "/_authenticated/operational/drafts" });
  const listFn = useServerFn(listSemesterDrafts);
  const reqFn = useServerFn(requestSemesterApproval);
  const reqWeekFn = useServerFn(dhRequestApprovalPerWeek);
  const weekThreadsFn = useServerFn(listWeekThreadsForDept);
  const qc = useQueryClient();
  const [openWorkspace, setOpenWorkspace] = useState<{ semester_id: string; week_num: number; title: string } | null>(null);

  useEffect(() => {
    if (search.chat && search.semester && search.week != null) {
      setOpenWorkspace({
        semester_id: search.semester,
        week_num: search.week,
        title: `Week ${search.week}`,
      });
    }
  }, [search.chat, search.semester, search.week]);

  const deptId = me?.profile?.department_id;
  useEffect(() => {
    if (!deptId) return;
    const ch = supabase.channel(`dh-drafts-${deptId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "semester_registry" },
        () => qc.invalidateQueries({ queryKey: ["semester-drafts"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules", filter: `department_id=eq.${deptId}` },
        () => qc.invalidateQueries({ queryKey: ["semester-drafts"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_feedback_threads", filter: `department_id=eq.${deptId}` },
        () => qc.invalidateQueries({ queryKey: ["week-feedback-threads", deptId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_feedback_messages" },
        () => qc.invalidateQueries({ queryKey: ["week-feedback-threads", deptId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deptId, qc]);
  const { data, isLoading } = useQuery({
    queryKey: ["semester-drafts", deptId],
    queryFn: () => listFn({ data: { department_id: deptId! } }),
    enabled: !!deptId,
  });
  const { data: weekThreads } = useQuery({
    queryKey: ["week-feedback-threads", deptId],
    queryFn: () => weekThreadsFn({ data: { department_id: deptId! } }),
    enabled: !!deptId,
  });

  const submitMut = useMutation({
    mutationFn: (semester_id: string) => reqFn({ data: { semester_id } }),
    onSuccess: () => {
      toast.success("Semester sent to Admin for approval");
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPerWeekMut = useMutation({
    mutationFn: (semester_id: string) => reqWeekFn({ data: { semester_id } }),
    onSuccess: (r) => {
      if ((r?.created ?? 0) === 0) {
        toast.warning("Nothing new to submit — all sessions are already pending or live.");
      } else {
        toast.success(`Submitted ${r.created} weekly session(s) to Admin`);
      }
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Schedule Drafts</h1>
        <p className="text-sm text-muted-foreground">Submit weeks individually (preferred) or submit the whole semester for one-shot approval.</p>
      </div>
      {(weekThreads ?? []).length > 0 && (
        <Card className="rounded-2xl border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-destructive" /> Week feedback from Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(weekThreads ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                <button type="button" className="text-left"
                  onClick={() => setOpenWorkspace({ semester_id: t.semester_id, week_num: t.week_num, title: `${t.semester_name} · Week ${t.week_num}` })}>
                  <p className="text-sm font-medium">{t.semester_name} · Week {t.week_num}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </button>
                <Button size="sm" variant="outline"
                  onClick={() => setOpenWorkspace({ semester_id: t.semester_id, week_num: t.week_num, title: `${t.semester_name} · Week ${t.week_num}` })}>
                  Open chat
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          No draft semesters. Upload one from Semester Upload.
        </CardContent></Card>
      )}
      {(data ?? []).map((s: any) => {
        const ds = s.distribution_status ?? "DRAFT";
        const canSubmit = ds === "DRAFT" || ds === "FEEDBACK_ACTIVE";
        return (
          <Card key={s.id} className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileClock className="h-4 w-4" /> {s.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{s.start_date} → {s.end_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[ds]}>{ds}</Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm"
                        disabled={!canSubmit || submitPerWeekMut.isPending}
                        onClick={() => submitPerWeekMut.mutate(s.id)}>
                        <CalendarRange className="mr-2 h-3 w-3" /> Submit by Week
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Sends each week as an individual approval — Admin can approve week-by-week.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button size="sm" variant="secondary"
                  disabled={!canSubmit || submitMut.isPending}
                  onClick={() => submitMut.mutate(s.id)}>
                  <Send className="mr-2 h-3 w-3" /> Request Semester Approval
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {s.weeks.map((w: any) => (
                  <button key={w.week_num} type="button"
                    onClick={() => setOpenWorkspace({ semester_id: s.id, week_num: w.week_num, title: `${s.name} · Week ${w.week_num}` })}
                    className="rounded-lg border p-2 text-center transition-colors hover:bg-accent/40">
                    <p className="text-xs font-semibold">Week {w.week_num}</p>
                    <p className="text-[11px] text-muted-foreground">{w.total} sessions</p>
                    {w.published > 0 && <Badge variant="default" className="mt-1 text-[10px]">{w.published} live</Badge>}
                    {w.pending > 0 && <Badge variant="destructive" className="mt-1 text-[10px]">{w.pending} pending</Badge>}
                  </button>
                ))}
              </div>
            </CardContent>
            <CardContent className="border-t pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Version history</p>
              <ApprovalVersionTimeline semesterId={s.id} />
            </CardContent>
          </Card>
        );
      })}
      {openWorkspace && (
        <WeekFeedbackWorkspace
          open
          onOpenChange={(o) => !o && setOpenWorkspace(null)}
          semesterId={openWorkspace.semester_id}
          weekNum={openWorkspace.week_num}
          title={openWorkspace.title}
        />
      )}
    </div>
  );
}