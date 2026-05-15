import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveScheduleState = {
  schedule_id: string;
  status: string;
  checked_in: boolean;
  attendance_count: number;
  ended: boolean;
};

export function useDhLiveChannel(departmentId: string | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!departmentId) return;
    const channel = supabase
      .channel(`dh-live-${departmentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_logs" }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => setTick((t) => t + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_overrides" }, () => setTick((t) => t + 1))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [departmentId]);
  return tick;
}
