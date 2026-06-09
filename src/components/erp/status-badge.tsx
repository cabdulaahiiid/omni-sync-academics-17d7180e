import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING: "bg-amber/15 text-amber-fg border-amber/40",
  PENDING_APPROVAL: "bg-amber/15 text-amber-fg border-amber/40",
  APPROVED: "bg-emerald/15 text-emerald border-emerald/40",
  REJECTED: "bg-rose/15 text-rose border-rose/40",
  FEEDBACK_ACTIVE: "bg-stat-blue/15 text-stat-blue border-stat-blue/40",
  FEEDBACK_REQUIRED: "bg-stat-blue/15 text-stat-blue border-stat-blue/40",
  LIVE: "bg-teal/15 text-teal border-teal/40",
  ACTIVE: "bg-teal/15 text-teal border-teal/40",
  COMPLETED: "bg-stat-green/15 text-stat-green border-stat-green/40",
  CANCELLED: "bg-rose/10 text-rose border-rose/30",
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const key = (status ?? "").toUpperCase();
  const style = STATUS_STYLES[key] ?? "bg-muted text-muted-foreground border-border";
  const label = key.replace(/_/g, " ") || "—";
  return (
    <Badge variant="outline" className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", style, className)}>
      {label}
    </Badge>
  );
}