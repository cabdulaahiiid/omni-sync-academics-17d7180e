import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/trainer/ui";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ground/students")({
  component: TrainerStudents,
});

function TrainerStudents() {
  const { data: me } = useMe();
  const trainerId = me?.profile?.trainer_registry_id;
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["trainer-students", trainerId],
    enabled: !!trainerId,
    staleTime: 60000,
    queryFn: async () => {
      const { data: scheds, error } = await supabase
        .from("schedules")
        .select("section_id")
        .eq("trainer_registry_id", trainerId!)
        .eq("is_published", true)
        .limit(500);
      if (error) throw error;
      const sectionIds = Array.from(new Set((scheds ?? []).map((s: any) => s.section_id).filter(Boolean)));
      if (!sectionIds.length) return [];
      const { data: students, error: sErr } = await supabase
        .from("students")
        .select("id, full_name, registration_number, section_id")
        .in("section_id", sectionIds as string[])
        .order("full_name")
        .limit(500);
      if (sErr) throw sErr;
      return students ?? [];
    },
  });

  const rows = (data ?? []).filter((s: any) =>
    !q.trim() ||
    (s.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (s.registration_number ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <SectionTitle>My Students</SectionTitle>
      <Input placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 bg-white" />
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {!isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Users className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No students found.</p>
        </div>
      )}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {rows.map((s: any, i: number) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 text-[12px] text-slate-400">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-900">{s.full_name}</p>
              <p className="text-[11px] text-slate-500">{s.registration_number}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
