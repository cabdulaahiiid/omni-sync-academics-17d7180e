import { useEffect, useState } from "react";

/** Display a mm:ss countdown to a target time. */
export function CountdownTimer({ until, label = "Time remaining" }: { until: string | Date | null; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const expired = ms <= 0;
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${expired ? "border-rose/40 bg-rose/5 text-rose" : "border-emerald/40 bg-emerald/5 text-emerald"}`}>
      <span className="font-medium">{label}: </span>
      <span className="font-mono tabular-nums">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
      {expired && <span className="ml-2 text-xs">(window closed)</span>}
    </div>
  );
}