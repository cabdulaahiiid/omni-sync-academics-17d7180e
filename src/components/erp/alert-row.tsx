import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertSeverity = "info" | "warning" | "critical";

const SEV: Record<AlertSeverity, { bg: string; text: string; icon: string }> = {
  info:     { bg: "bg-stat-blue/10",   text: "text-stat-blue",   icon: "text-stat-blue" },
  warning:  { bg: "bg-amber/15",       text: "text-amber-fg",    icon: "text-amber-fg" },
  critical: { bg: "bg-rose/15",        text: "text-rose",        icon: "text-rose" },
};

export function AlertRow({
  icon: Icon = AlertTriangle,
  severity = "warning",
  title,
  detail,
  count,
  to,
}: {
  icon?: LucideIcon;
  severity?: AlertSeverity;
  title: string;
  detail?: string;
  count?: number;
  to?: string;
}) {
  const sev = SEV[severity];
  const inner = (
    <div className="group flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", sev.bg)}>
        <Icon className={cn("h-4 w-4", sev.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
        {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
      </div>
      {count != null && (
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", sev.bg, sev.text)}>
          {count}
        </span>
      )}
      {to && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
    </div>
  );
  return to ? <Link to={to as string}>{inner}</Link> : inner;
}