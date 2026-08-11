import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { getMyProgress } from "@/lib/trainer.functions";
import { SectionTitle, StatTile } from "@/components/trainer/ui";
import { FileText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/reports")({
  component: TrainerReports,
});

function TrainerReports() {
  const { data: me } = useMe();
  const trainerId = me?.profile?.trainer_registry_id;
  const progressFn = useServerFn(getMyProgress);
  const { data: progress } = useQuery({ queryKey: ["my-progress"], queryFn: () => progressFn(), staleTime: 30000 });

  const { data, isLoading } = useQuery({
    queryKey: ["trainer-reports", trainerId],
    enabled: !!trainerId,
    staleTime: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, date, start_time, end_time, module_code, module_name")
        .eq("trainer_registry_id", trainerId!)
        .eq("status", "ENDED")
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const completed = progress?.completed ?? 0;
  const target = progress?.target ?? 15;

  return (
    <div className="space-y-4">
      <SectionTitle>Reports</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Sessions Completed" value={completed} />
        <StatTile label="Target Sessions" value={target} />
      </div>
      <SectionTitle>Session Reports</SectionTitle>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <FileText className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No session reports yet.</p>
        </div>
      )}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {(data ?? []).map((s: any) => (
          <Link
            key={s.id}
            to="/ground/$scheduleId"
            params={{ scheduleId: s.id }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#123E7C]/10 text-[#123E7C]">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-900">{s.module_name}</p>
              <p className="text-[11px] text-slate-500">
                {s.module_code} • {s.date} • {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
