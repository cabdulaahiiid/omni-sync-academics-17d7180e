import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/lib/ui/health-score";

const TONE: Record<HealthScore["tone"], { ring: string; chip: string; bar: string }> = {
  ok:   { ring: "stroke-emerald",   chip: "bg-emerald/15 text-emerald",       bar: "bg-emerald" },
  info: { ring: "stroke-stat-blue", chip: "bg-stat-blue/15 text-stat-blue",   bar: "bg-stat-blue" },
  warn: { ring: "stroke-amber",     chip: "bg-amber/20 text-amber-fg",        bar: "bg-amber" },
  crit: { ring: "stroke-rose",      chip: "bg-rose/15 text-rose",             bar: "bg-rose" },
};

export function HealthScoreCard({
  health,
  weeklyDelta,
}: {
  health: HealthScore;
  weeklyDelta: number | null;
}) {
  const tone = TONE[health.tone];
  const circ = 2 * Math.PI * 42;
  const dash = (health.score / 100) * circ;
  const up = (weeklyDelta ?? 0) >= 0;

  return (
    <div className="card-elevated relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border/70 p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Institution Health
          </p>
          <h3 className="mt-1 text-[15px] font-semibold tracking-tight">Composite score</h3>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone.chip)}>
          {health.badge}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" strokeWidth="9" className="fill-none stroke-muted" />
            <circle
              cx="50" cy="50" r="42" strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className={cn("fill-none transition-all duration-700 ease-out", tone.ring)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="kpi-counter text-[28px] font-semibold leading-none tracking-tight">
              {health.score}
            </span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {health.components.map((c) => (
            <div key={c.label} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="font-semibold tabular-nums">{c.value}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", tone.bar)}
                  style={{ width: `${Math.min(100, c.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Activity className="h-3 w-3" /> Updated just now
        </span>
        {weeklyDelta != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              up ? "bg-emerald/15 text-emerald" : "bg-rose/15 text-rose",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}{weeklyDelta} pts this week
          </span>
        ) : (
          <span className="text-muted-foreground">baseline</span>
        )}
      </div>
    </div>
  );
}