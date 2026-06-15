import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";

export interface KpiTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "blue" | "green" | "purple" | "orange" | "rose" | "amber";
  delta?: number | null;
  trend?: number[];
  to?: string;
  onClick?: () => void;
  lastUpdated?: number | null;
  emptyHint?: string;
  compact?: boolean;
}

const TONE: Record<NonNullable<KpiTileProps["tone"]>, { bg: string; fg: string; stroke: string }> = {
  blue:   { bg: "var(--stat-blue)",   fg: "var(--stat-blue-fg)",   stroke: "var(--stat-blue)" },
  green:  { bg: "var(--stat-green)",  fg: "var(--stat-green-fg)",  stroke: "var(--stat-green)" },
  purple: { bg: "var(--stat-purple)", fg: "var(--stat-purple-fg)", stroke: "var(--stat-purple)" },
  orange: { bg: "var(--stat-orange)", fg: "var(--stat-orange-fg)", stroke: "var(--stat-orange)" },
  rose:   { bg: "var(--rose)",        fg: "var(--rose-fg)",        stroke: "var(--rose)" },
  amber:  { bg: "var(--amber)",       fg: "var(--amber-fg)",       stroke: "var(--amber)" },
};

function formatUpdated(ts?: number | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function KpiTile(props: KpiTileProps) {
  const tone = TONE[props.tone ?? "blue"];
  const series = (props.trend ?? []).map((v, i) => ({ i, v }));
  const hasDelta = props.delta != null && Number.isFinite(props.delta);
  const up = (props.delta ?? 0) >= 0;
  const isZero = props.value === 0 || props.value === "0" || props.value === "0%";

  if (props.compact) {
    const inner = (
      <div
        className={cn(
          "group flex h-full items-center gap-3 rounded-lg border border-border/70 bg-[var(--surface-raised)] p-2.5 transition-all hover:border-border hover:shadow-[0_2px_8px_-2px_rgb(15_23_42_/_0.08)]",
          (props.to || props.onClick) && "cursor-pointer",
        )}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <props.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {props.label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-semibold leading-tight tracking-tight text-foreground">
              {props.value}
            </span>
            {hasDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-semibold",
                  up ? "text-emerald" : "text-rose",
                )}
              >
                {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {Math.abs(props.delta as number)}%
              </span>
            )}
          </div>
          {isZero && props.emptyHint && (
            <p className="truncate text-[9px] text-muted-foreground">{props.emptyHint}</p>
          )}
        </div>
      </div>
    );
    if (props.to) return <Link to={props.to as string} onClick={props.onClick} className="block h-full">{inner}</Link>;
    if (props.onClick) return <button type="button" onClick={props.onClick} className="block h-full w-full text-left">{inner}</button>;
    return inner;
  }

  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-xl border border-border/70 p-4 transition-all",
        "bg-[var(--surface-raised)] hover:border-border hover:shadow-[0_2px_8px_-2px_rgb(15_23_42_/_0.08)]",
        (props.to || props.onClick) && "cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {props.label}
        </span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <props.icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[28px] font-semibold tracking-tight leading-none text-foreground">
          {props.value}
        </span>
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              up ? "bg-emerald/15 text-emerald" : "bg-rose/15 text-rose",
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(props.delta as number)}%
          </span>
        )}
      </div>
      {series.length > 1 ? (
        <div className="h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={tone.stroke}
                strokeWidth={1.75}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-8" />
      )}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{isZero && props.emptyHint ? props.emptyHint : `Updated ${formatUpdated(props.lastUpdated)}`}</span>
        {(props.to || props.onClick) && (
          <span className="opacity-0 transition-opacity group-hover:opacity-100">View →</span>
        )}
      </div>
    </div>
  );

  if (props.to) {
    return (
      <Link to={props.to as string} onClick={props.onClick} className="block h-full">
        {body}
      </Link>
    );
  }
  if (props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className="block h-full w-full text-left">
        {body}
      </button>
    );
  }
  return body;
}