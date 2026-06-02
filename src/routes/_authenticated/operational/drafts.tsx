import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSemesterDrafts, requestSemesterApproval } from "@/lib/semester-drafts.functions";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileClock } from "lucide-react";
import { toast } from "sonner";

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
  const qc = useQueryClient();

  const deptId = me?.profile?.department_id;
  const { data, isLoading } = useQuery({
    queryKey: ["semester-drafts", deptId],
    queryFn: () => listFn({ data: { department_id: deptId! } }),
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
                  <div key={w.week_num} className="rounded-lg border p-2 text-center">
                    <p className="text-xs font-semibold">Week {w.week_num}</p>
                    <p className="text-[11px] text-muted-foreground">{w.total} sessions</p>
                    {w.published > 0 && <Badge variant="default" className="mt-1 text-[10px]">{w.published} live</Badge>}
                    {w.pending > 0 && <Badge variant="destructive" className="mt-1 text-[10px]">{w.pending} pending</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}