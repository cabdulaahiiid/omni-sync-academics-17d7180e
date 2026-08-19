import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export type CoordinatorSummary = {
  cross_department: boolean;
  by_status: { status: string; total: number }[];
  by_department: { department_id: string; department_name: string; total: number; open_total: number }[];
  oldest_pending: {
    id: string;
    reference: string | null;
    title: string | null;
    status: string;
    department_name: string;
    submitted_at: string | null;
    created_at: string;
    age_days: number;
  }[];
};

/**
 * Cross-department aggregate of Department Head industrial training requests.
 *
 * The database function decides the scope: coordinators (IPS), program
 * directors and admins see every department; a department head calling the
 * same endpoint only ever gets their own department back.
 */
export const getCoordinatorSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA", "IPS", "PD", "DH"], "getCoordinatorSummary");
    const { data, error } = await (context.supabase.rpc as any)("ct_coordinator_request_summary");
    if (error) throw new Error(error.message);
    return data as CoordinatorSummary;
  });
