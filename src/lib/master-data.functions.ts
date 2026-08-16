import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One authoritative read of every master-data table used by registration
 * and data-entry forms. RLS still applies — this widens nothing.
 */
export const getMasterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [departments, levels, sections, modules, trainers, venues, semesters, trainerLinks] =
      await Promise.all([
        supabase.from("departments").select("id, name, status").order("name"),
        supabase.from("levels").select("id, name, display_name, department_id, status"),
        supabase.from("sections").select("id, name, level_id, department_id").order("name"),
        supabase.from("modules").select("id, code, name, level_id, department_id, type, status").order("code"),
        supabase.from("trainer_registry").select("id, full_name, email, phone, department_id, status").order("full_name"),
        supabase.from("venues").select("id, name, type, capacity").order("name"),
        supabase.from("semester_registry").select("id, name, status, start_date, end_date").order("start_date", { ascending: false }),
        supabase.from("trainer_departments").select("trainer_registry_id, department_id, is_primary"),
      ]);

    const levelOrder = ["I", "II", "III", "IV", "V"];
    return {
      departments: departments.data ?? [],
      levels: (levels.data ?? []).sort(
        (a, b) => levelOrder.indexOf(String(a.name)) - levelOrder.indexOf(String(b.name)),
      ),
      sections: sections.data ?? [],
      modules: modules.data ?? [],
      trainers: trainers.data ?? [],
      venues: venues.data ?? [],
      semesters: semesters.data ?? [],
      trainerLinks: trainerLinks.data ?? [],
    };
  });