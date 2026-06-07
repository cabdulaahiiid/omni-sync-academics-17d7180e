import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listSemesterDrafts, requestSemesterApproval } from "@/lib/semester-drafts.functions";
import { listWeekThreadsForDept } from "@/lib/feedback.functions";
import { FeedbackChat } from "@/components/feedback-chat";
import { WeekTimetableDialog } from "@/components/week-timetable-dialog";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileClock, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/operational/drafts")({
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
  const listFn = useServerFn(listSemesterDrafts);
  const reqFn = useServerFn(requestSemesterApproval);
  const weekThreadsFn = useServerFn(listWeekThreadsForDept);
  const qc = useQueryClient();
  const [openThread, setOpenThread] = useState<{ semester_id: string; week_num: number; title: string } | null>(null);
  const [openWeek, setOpenWeek] = useState<{ semester_id: string; week_num: number; title: string } | null>(null);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Schedule Drafts</h1>
        <p className="text-sm text-muted-foreground">Review sliced weeks and request Admin approval for the whole semester.</p>
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
                  onClick={() => setOpenWeek({ semester_id: t.semester_id, week_num: t.week_num, title: `${t.semester_name} · Week ${t.week_num}` })}>
                  <p className="text-sm font-medium">{t.semester_name} · Week {t.week_num}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </button>
                <Button size="sm" variant="outline"
                  onClick={() => setOpenThread({ semester_id: t.semester_id, week_num: t.week_num, title: `${t.semester_name} · Week ${t.week_num}` })}>
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
                <Button size="sm" disabled={!canSubmit || submitMut.isPending}
                  onClick={() => submitMut.mutate(s.id)}>
                  <Send className="mr-2 h-3 w-3" /> Request Semester Approval
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {s.weeks.map((w: any) => (
                  <button key={w.week_num} type="button"
                    onClick={() => setOpenWeek({ semester_id: s.id, week_num: w.week_num, title: `${s.name} · Week ${w.week_num}` })}
                    className="rounded-lg border p-2 text-center transition-colors hover:bg-accent/40">
                    <p className="text-xs font-semibold">Week {w.week_num}</p>
                    <p className="text-[11px] text-muted-foreground">{w.total} sessions</p>
                    {w.published > 0 && <Badge variant="default" className="mt-1 text-[10px]">{w.published} live</Badge>}
                    {w.pending > 0 && <Badge variant="destructive" className="mt-1 text-[10px]">{w.pending} pending</Badge>}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {openThread && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg">
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="secondary" onClick={() => setOpenThread(null)}>Close</Button>
            </div>
            <FeedbackChat semesterId={openThread.semester_id} weekNum={openThread.week_num} title={openThread.title} />
          </div>
        </div>
      )}
      {openWeek && (
        <WeekTimetableDialog
          open={!!openWeek}
          onOpenChange={(o) => !o && setOpenWeek(null)}
          semesterId={openWeek.semester_id}
          weekNum={openWeek.week_num}
          title={openWeek.title}
        />
      )}
    </div>
  );
}