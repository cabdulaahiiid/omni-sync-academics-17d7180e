import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One read for every practical-training monitoring screen (placements,
 * logbooks, supervision, evaluation, reports).
 *
 * Scope is decided on the server: RLS already limits what each role can read,
 * and Program Directors are additionally narrowed to the requests that were
 * explicitly delegated to them.
 */
export const getCtWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;

    const [{ data: roleRows }, { data: delegations }] = await Promise.all([
      sb.from("user_roles").select("role").eq("user_id", userId),
      sb.from("ct_request_delegations").select("request_id").eq("delegated_to", userId),
    ]);
    const roles = ((roleRows ?? []) as { role: string }[]).map((r) => r.role);
    const isPd = roles.includes("PD") && !roles.includes("MA") && !roles.includes("IPS");
    const delegatedRequestIds = [
      ...new Set(((delegations ?? []) as { request_id: string }[]).map((d) => d.request_id)),
    ];

    let placementQuery = sb
      .from("ct_student_placements")
      .select(
        "id, request_id, student_id, enterprise_id, training_site_id, mentor_contact_id, visiting_trainer_id, department_id, occupation_id, start_date, end_date, status, locked, created_at",
      )
      .order("start_date", { ascending: false })
      .limit(500);
    if (isPd) {
      if (delegatedRequestIds.length === 0) {
        return emptyWorkspace(roles);
      }
      placementQuery = placementQuery.in("request_id", delegatedRequestIds);
    }

    const { data: placements, error } = await placementQuery;
    if (error) throw new Error(error.message);
    const rows = (placements ?? []) as any[];
    const placementIds = rows.map((p) => p.id);
    const studentIds = [...new Set(rows.map((p) => p.student_id).filter(Boolean))];
    const enterpriseIds = [...new Set(rows.map((p) => p.enterprise_id).filter(Boolean))];
    const siteIds = [...new Set(rows.map((p) => p.training_site_id).filter(Boolean))];
    const contactIds = [...new Set(rows.map((p) => p.mentor_contact_id).filter(Boolean))];

    const inList = (table: string, cols: string, column: string, ids: string[]) =>
      ids.length ? sb.from(table).select(cols).in(column, ids) : Promise.resolve({ data: [] as any[] });

    const [
      students, enterprises, sites, contacts, logbooks, visits, evaluations, checkins, absences, requests, departments,
    ] = await Promise.all([
      inList("students", "id, full_name, registration_number, department_id, level_id, section_id", "id", studentIds),
      inList("ct_enterprises", "id, name, code, sector, phone", "id", enterpriseIds),
      inList("ct_enterprise_training_sites", "id, name, location", "id", siteIds),
      inList("ct_enterprise_contacts", "id, full_name, role_title, phone", "id", contactIds),
      inList(
        "ct_daily_logbook_entries",
        "id, placement_id, entry_date, task_description, hours, status, submitted_at",
        "placement_id",
        placementIds,
      ),
      inList(
        "ct_supervision_visits",
        "id, placement_id, visit_date, visited_by, findings, actions, geo_verified, distance_meters",
        "placement_id",
        placementIds,
      ),
      inList(
        "ct_final_evaluations",
        "id, placement_id, source, evaluator_name, overall_comment, failed_uc_count, red_competency_count, remedial_hours, recommendation, finalized, finalized_at",
        "placement_id",
        placementIds,
      ),
      inList("ct_day1_checkins", "id, placement_id, checked_in_at, geo_verified", "placement_id", placementIds),
      inList("ct_absence_events", "id, placement_id, from_date, to_date, consecutive_days, reason", "placement_id", placementIds),
      inList(
        "ct_training_requests",
        "id, reference, title, status, department_id, manual_initiation",
        "id",
        [...new Set(rows.map((p) => p.request_id).filter(Boolean))],
      ),
      sb.from("departments").select("id, name"),
    ]);

    return {
      roles,
      placements: rows,
      students: (students.data ?? []) as any[],
      enterprises: (enterprises.data ?? []) as any[],
      sites: (sites.data ?? []) as any[],
      mentors: (contacts.data ?? []) as any[],
      logbooks: (logbooks.data ?? []) as any[],
      visits: (visits.data ?? []) as any[],
      evaluations: (evaluations.data ?? []) as any[],
      checkins: (checkins.data ?? []) as any[],
      absences: (absences.data ?? []) as any[],
      requests: (requests.data ?? []) as any[],
      departments: (departments.data ?? []) as any[],
    };
  });

function emptyWorkspace(roles: string[]) {
  return {
    roles,
    placements: [] as any[],
    students: [] as any[],
    enterprises: [] as any[],
    sites: [] as any[],
    mentors: [] as any[],
    logbooks: [] as any[],
    visits: [] as any[],
    evaluations: [] as any[],
    checkins: [] as any[],
    absences: [] as any[],
    requests: [] as any[],
    departments: [] as any[],
  };
}
