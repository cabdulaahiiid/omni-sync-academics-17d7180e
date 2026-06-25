import { useEffect, useState } from "react";

/** Display a mm:ss countdown to a target time. */
export function CountdownTimer({ until, label = "Time remaining", variant = "bar", offsetMs = 0, totalMs }: { until: string | Date | null; label?: string; variant?: "bar" | "ring"; offsetMs?: number; totalMs?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - (now + offsetMs));
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const expired = ms <= 0;
  if (variant === "ring") {
    // Ring fill: caller can override totalMs (defaults to 50 minutes).
    const total = totalMs ?? 50 * 60_000;
    const pct = Math.max(0, Math.min(1, ms / total));
    const size = 180;
    const stroke = 12;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - pct);
    const color = expired ? "hsl(var(--destructive))" : pct < 0.2 ? "hsl(var(--destructive))" : "hsl(var(--primary))";
    return (
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Countdown</span>
          <span className="font-mono text-3xl font-semibold tabular-nums">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${expired ? "border-rose/40 bg-rose/5 text-rose" : "border-emerald/40 bg-emerald/5 text-emerald"}`}>
      <span className="font-medium">{label}: </span>
      <span className="font-mono tabular-nums">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
      {expired && <span className="ml-2 text-xs">(window closed)</span>}
    </div>
  );
}