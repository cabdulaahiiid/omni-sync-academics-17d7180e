import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ACTION_COLOR: Record<string, string> = {
  CREATE: "bg-emerald/15 text-emerald border-emerald/30",
  INSERT: "bg-emerald/15 text-emerald border-emerald/30",
  UPDATE: "bg-stat-blue/15 text-stat-blue border-stat-blue/30",
  DELETE: "bg-rose/15 text-rose border-rose/30",
  APPROVE: "bg-teal/15 text-teal border-teal/40",
  REJECT: "bg-rose/15 text-rose border-rose/30",
  WARNING: "bg-amber/20 text-amber-fg border-amber/40",
  OVERRIDE: "bg-amber/20 text-amber-fg border-amber/40",
  SUBMIT_FOR_APPROVAL: "bg-stat-purple/15 text-stat-purple border-stat-purple/30",
  SUBMIT_PER_WEEK: "bg-stat-purple/15 text-stat-purple border-stat-purple/30",
  APPROVE_WEEK: "bg-teal/15 text-teal border-teal/40",
  REJECT_WEEK_WITH_FEEDBACK: "bg-rose/15 text-rose border-rose/30",
  RESUBMIT: "bg-stat-blue/15 text-stat-blue border-stat-blue/30",
};

export function ActivityRow({
  action,
  entity,
  detail,
  timestamp,
  to,
}: {
  action: string;
  entity?: string;
  detail?: string;
  timestamp: string;
  to?: string;
}) {
  const cls = ACTION_COLOR[action?.toUpperCase()] ?? "bg-muted text-muted-foreground border-border";
  const inner = (
    <li className="relative pl-4">
      <span className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-stat-blue ring-2 ring-card" />
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className={cn("rounded-md border text-[10px] font-semibold", cls)}>
            {action}
          </Badge>
          {entity && <span className="truncate text-[12px] text-foreground">{entity}</span>}
          {detail && <span className="truncate text-[11px] text-muted-foreground">— {detail}</span>}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </li>
  );
  return to ? <Link to={to as string}>{inner}</Link> : inner;
}