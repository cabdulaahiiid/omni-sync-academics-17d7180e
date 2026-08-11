import { Link } from "@tanstack/react-router";
import { Lock, CircleDot, CheckCircle2, MapPin } from "lucide-react";

export const NAVY = "#123E7C";

export type SessionStatus = "in-progress" | "upcoming" | "completed" | "missed";

export function statusOf(s: { status?: string | null; date?: string | null; end_time?: string | null }, nowMs = Date.now()): SessionStatus {
  if (s.status === "ENDED") return "completed";
  if (s.status === "ACTIVE" || s.status === "LIVE") return "in-progress";
  const endMs = s.date && s.end_time ? new Date(`${s.date}T${s.end_time}`).getTime() : 0;
  if (endMs && nowMs > endMs) return "missed";
  return "upcoming";
}

const PILL: Record<SessionStatus, { text: string; cls: string }> = {
  "in-progress": { text: "In Progress", cls: "bg-[#16A34A]/12 text-[#16A34A]" },
  upcoming: { text: "Upcoming", cls: "bg-slate-100 text-slate-500" },
  completed: { text: "Completed", cls: "bg-[#123E7C]/10 text-[#123E7C]" },
  missed: { text: "Missed", cls: "bg-[#DC2626]/10 text-[#DC2626]" },
};

export function StatusPill({ status }: { status: SessionStatus }) {
  const p = PILL[status];
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${p.cls}`}>{p.text}</span>;
}

export function StatTile({ label, value, to }: { label: string; value: number | string; to?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-2xl font-bold leading-none text-[#123E7C]">{value}</span>
        {to ? (
          <Link to={to} className="text-[11px] font-semibold text-[#123E7C] hover:underline">View</Link>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[15px] font-semibold text-[#123E7C]">{children}</h2>;
}

export function MetaLine({ code, level, section }: { code?: string | null; level?: string | null; section?: string | null }) {
  const parts = [code, level, section].filter(Boolean);
  return <p className="mt-0.5 text-[11px] text-slate-500">{parts.join(" • ")}</p>;
}

export function SessionRowCard({
  id, title, code, level, section, time, status,
}: {
  id: string; title: string; code?: string | null; level?: string | null; section?: string | null;
  time: string; status: SessionStatus;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-slate-900">{title}</p>
          <MetaLine code={code} level={level} section={section} />
          <p className="mt-1 text-[11px] text-slate-500">{time}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill status={status} />
          <Link
            to="/ground/$scheduleId"
            params={{ scheduleId: id }}
            className="text-[11px] font-semibold text-[#123E7C] hover:underline"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}

export type StepState = "done" | "current" | "locked";

export function StepList({ steps }: { steps: { label: string; state: StepState; hint?: string }[] }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3 px-4 py-3">
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
              s.state === "done"
                ? "bg-[#16A34A]/15 text-[#16A34A]"
                : s.state === "current"
                ? "bg-[#123E7C] text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {i + 1}
          </span>
          <span className={`flex-1 text-[13px] ${s.state === "locked" ? "text-slate-400" : "font-medium text-slate-800"}`}>
            {s.label}
          </span>
          <span className="text-[11px] text-slate-400">
            {s.state === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
            ) : s.state === "current" ? (
              <span className="inline-flex items-center gap-1 font-medium text-[#123E7C]">
                <CircleDot className="h-3.5 w-3.5" /> {s.hint ?? "In progress"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Locked</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function GeoRadar({ ok }: { ok: boolean }) {
  return (
    <div className="relative mx-auto grid h-44 w-44 place-items-center">
      <span className={`absolute inset-0 rounded-full ${ok ? "bg-[#16A34A]/10" : "bg-[#123E7C]/10"}`} />
      <span className={`absolute inset-6 rounded-full ${ok ? "bg-[#16A34A]/15" : "bg-[#123E7C]/15"}`} />
      <span className={`absolute inset-12 rounded-full ${ok ? "bg-[#16A34A]/25" : "bg-[#123E7C]/25"} animate-pulse`} />
      {ok ? (
        <CheckCircle2 className="relative h-16 w-16 text-[#16A34A]" />
      ) : (
        <MapPin className="relative h-12 w-12 text-[#123E7C]" />
      )}
    </div>
  );
}

export function DetailTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <span className="text-[12px] text-slate-500">{k}</span>
          <span className="truncate text-[12px] font-medium text-slate-900">{v}</span>
        </div>
      ))}
    </div>
  );
}
