import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/completed")({
  component: CompletedSessions,
});

function CompletedSessions() {
  const { data: me } = useMe();
  const trainerId = me?.profile?.trainer_registry_id;
  const { data, isLoading } = useQuery({
    queryKey: ["trainer-completed", trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("id, date, day, start_time, end_time, module_code, module_name, status, section_id, venue_id")
        .eq("trainer_registry_id", trainerId!)
        .eq("status", "ENDED")
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Completed Sessions</h1>
        <p className="text-sm text-slate-500">Your archived teaching sessions.</p>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No completed sessions yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {(data ?? []).map((s: any) => (
          <Link key={s.id} to="/ground/$scheduleId" params={{ scheduleId: s.id }} className="block">
            <Card className="rounded-2xl border-slate-200 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">{s.module_code}</span>
                    <Badge className="bg-[#16A34A]/10 text-[#16A34A] hover:bg-[#16A34A]/10">Completed</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{s.module_name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" /> {s.date} · {String(s.start_time).slice(0, 5)}–{String(s.end_time).slice(0, 5)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}