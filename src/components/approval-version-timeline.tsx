import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getApprovalHistory } from "@/lib/approval-history.functions";
import { CheckCircle2, RotateCcw, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ApprovalVersionTimeline({
  semesterId,
  weekNum = null,
}: { semesterId: string; weekNum?: number | null }) {
  const fn = useServerFn(getApprovalHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["approval-history", semesterId, weekNum],
    queryFn: () => fn({ data: { semester_id: semesterId, week_num: weekNum } }),
    staleTime: 15000,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading version history…</p>;
  const versions = data?.versions ?? [];
  if (!versions.length) return <p className="text-xs text-muted-foreground">No submissions yet.</p>;

  return (
    <ol className="relative space-y-3 border-l border-border/60 pl-4">
      {versions.map((v) => {
        const Icon =
          v.decision === "approved" ? CheckCircle2 :
          v.decision === "rejected" ? RotateCcw :
          Clock;
        const color =
          v.decision === "approved" ? "text-emerald-600" :
          v.decision === "rejected" ? "text-amber-600" :
          "text-muted-foreground";
        return (
          <li key={v.bucket_key} className="relative">
            <span className={cn("absolute -left-[22px] top-0.5 h-3 w-3 rounded-full border-2 bg-background", color, "border-current")} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", color)} />
                  Version {v.version}
                  <Badge variant={v.decision === "approved" ? "default" : v.decision === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                    {v.decision === "pending" ? "AWAITING REVIEW" :
                      v.decision === "approved" ? "APPROVED" : "RETURNED"}
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Submitted {new Date(v.submitted_at).toLocaleString()}
                  {v.submitted_by ? ` by ${v.submitted_by}` : ""}
                  {v.item_count > 1 ? ` · ${v.item_count} items` : ""}
                </p>
                {v.decided_at && (
                  <p className="text-[11px] text-muted-foreground">
                    {v.decision === "approved" ? "Approved" : "Returned"}{" "}
                    {new Date(v.decided_at).toLocaleString()}
                    {v.decided_by ? ` by ${v.decided_by}` : ""}
                  </p>
                )}
                {v.feedback && (
                  <p className="mt-1 rounded bg-muted/40 px-2 py-1 text-[11px] italic">
                    “{v.feedback}”
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}