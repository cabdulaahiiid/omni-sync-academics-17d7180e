import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportingStat = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  to: string;
};

export function ReportingStrip({ stats }: { stats: ReportingStat[] }) {
  return (
    <div className="card-elevated rounded-2xl border border-border/70 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Institution Totals
        </p>
        <span className="text-[10px] text-muted-foreground">Click any tile to drill into the source</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={cn(
              "group flex items-center gap-2 rounded-xl border border-border/60 bg-[var(--surface-sunken)] px-3 py-2.5 row-hover hover:bg-muted/60",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-stat-blue ring-1 ring-stat-blue/15">
              <s.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-semibold leading-none tabular-nums">{s.value}</p>
              <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}