import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, AlertTriangle, TrendingUp, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "info" | "warn" | "crit";
export type Insight = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  icon?: "alert" | "trend" | "users" | "activity";
  to?: string;
};

const ICON = {
  alert: AlertTriangle,
  trend: TrendingUp,
  users: Users,
  activity: Activity,
};

const SEV: Record<Severity, string> = {
  info: "bg-stat-blue/10 text-stat-blue ring-stat-blue/20",
  warn: "bg-amber/15 text-amber-fg ring-amber/30",
  crit: "bg-rose/15 text-rose ring-rose/30",
};

export function AIInsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <div className="card-elevated rounded-2xl border border-border/70 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stat-purple/15 text-stat-purple">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Intelligence Panel</h3>
            <p className="text-[10.5px] text-muted-foreground">Derived from current institution data</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {insights.length} signals
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {insights.length === 0 ? (
          <p className="text-xs text-muted-foreground">No anomalies detected. Operations look healthy.</p>
        ) : insights.map((ins) => {
          const Icon = ICON[ins.icon ?? "activity"];
          const inner = (
            <div
              className={cn(
                "group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3 row-hover hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                  SEV[ins.severity],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-tight">{ins.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{ins.detail}</p>
              </div>
              {ins.to && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </div>
          );
          return ins.to ? (
            <Link key={ins.id} to={ins.to}>{inner}</Link>
          ) : (
            <div key={ins.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}