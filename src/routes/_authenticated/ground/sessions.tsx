import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { SessionRowCard, statusOf, SectionTitle } from "@/components/trainer/ui";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/sessions")({
  component: SessionsOverview,
});

const TABS = ["Today", "Upcoming", "Past", "Missed"] as const;
type Tab = typeof TABS[number];

function SessionsOverview() {
  const { data: me } = useMe();
  const trainerId = me?.profile?.trainer_registry_id;
  const [tab, setTab] = useState<Tab>("Today");

  const { data, isLoading } = useQuery({
    queryKey: ["trainer-all-sessions", trainerId],
    enabled: !!trainerId,
    staleTime: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, date, day, start_time, end_time, module_code, module_name, status, section_id, level_id")
        .eq("trainer_registry_id", trainerId!)
        .eq("is_published", true)
        .order("date", { ascending: false })
        .order("start_time")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const rows = (data ?? []).filter((s: any) => {
    if (tab === "Today") return s.date === today;
    if (tab === "Upcoming") return s.date > today;
    if (tab === "Past") return s.status === "ENDED";
    return s.date < today && s.status !== "ENDED";
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
              tab === t ? "bg-[#123E7C] text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <SectionTitle>{tab} Sessions</SectionTitle>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No {tab.toLowerCase()} sessions.</p>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((s: any) => (
          <SessionRowCard
            key={s.id}
            id={s.id}
            title={s.module_name}
            code={s.module_code}
            time={`${s.date} · ${String(s.start_time).slice(0, 5)} – ${String(s.end_time).slice(0, 5)}`}
            status={statusOf(s)}
          />
        ))}
      </div>
    </div>
  );
}
