import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Trainers belonging to a department = union of
 *   - trainer_registry.department_id (their primary/home department), and
 *   - trainer_departments rows (multi-department assignments made by an Admin).
 *
 * Read-only helper: it never widens who may read what — RLS still applies to
 * whichever client is passed in.
 */
export async function listDepartmentTrainers<T extends Record<string, any> = any>(
  supabase: SupabaseClient<any>,
  departmentId: string,
  columns = "id, full_name",
): Promise<T[]> {
  const [{ data: primary }, { data: links }] = await Promise.all([
    supabase.from("trainer_registry").select(columns).eq("department_id", departmentId),
    supabase
      .from("trainer_departments")
      .select("trainer_registry_id")
      .eq("department_id", departmentId),
  ]);

  const byId = new Map<string, any>();
  for (const t of (primary as any[]) ?? []) byId.set(t.id, t);

  const extraIds = ((links as any[]) ?? [])
    .map((r) => r.trainer_registry_id as string)
    .filter((id) => id && !byId.has(id));

  if (extraIds.length) {
    const { data: extras } = await supabase
      .from("trainer_registry")
      .select(columns)
      .in("id", extraIds);
    for (const t of (extras as any[]) ?? []) byId.set(t.id, t);
  }

  return Array.from(byId.values()).sort((a, b) =>
    String(a.full_name ?? "").localeCompare(String(b.full_name ?? "")),
  ) as T[];
}
