import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";

export const listCtSupervision = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: visits }, { data: absences }] = await Promise.all([
      context.supabase
        .from("ct_supervision_visits")
        .select("id, placement_id, visit_date, findings, actions, geo_verified, distance_meters, created_at")
        .order("visit_date", { ascending: false })
        .limit(200),
      context.supabase
        .from("ct_absence_events")
        .select("id, placement_id, from_date, to_date, consecutive_days, parent_notified, reason")
        .order("from_date", { ascending: false })
        .limit(200),
    ]);
    const visitIds = (visits ?? []).map((v) => v.id);
    const { data: evidence } = visitIds.length
      ? await context.supabase
          .from("ct_supervision_evidence")
          .select("id, visit_id, storage_path, caption")
          .in("visit_id", visitIds)
      : { data: [] as any[] };
    return { visits: (visits ?? []) as any[], absences: (absences ?? []) as any[], evidence: (evidence ?? []) as any[] };
  });

export const recordCtSupervision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        placement_id: z.string().uuid(),
        visit_date: z.string().min(10),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        findings: z.string().trim().min(3).max(2000),
        actions: z.string().trim().max(2000).optional().nullable(),
        evidence_paths: z.array(z.string().max(400)).max(10).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "VT", "T", "CO"], "recordCtSupervision");
    const { data: visitId, error } = await (context.supabase.rpc as any)("ct_record_supervision", {
      _placement_id: data.placement_id,
      _visit_date: data.visit_date,
      _lat: data.latitude ?? null,
      _lng: data.longitude ?? null,
      _findings: data.findings,
      _actions: data.actions ?? null,
    });
    if (error) throw new Error(error.message);
    if (data.evidence_paths.length) {
      await context.supabase.from("ct_supervision_evidence").insert(
        data.evidence_paths.map((storage_path) => ({
          visit_id: visitId as unknown as string,
          storage_path,
          uploaded_by: context.userId,
        })),
      );
    }
    return { id: visitId as unknown as string };
  });

/** Signed URLs for private supervision photos. */
export const getCtEvidenceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paths: z.array(z.string().max(400)).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const out: Record<string, string> = {};
    for (const path of data.paths) {
      const { data: signed } = await context.supabase.storage.from("ct-evidence").createSignedUrl(path, 3600);
      if (signed?.signedUrl) out[path] = signed.signedUrl;
    }
    return out;
  });

export const detectCtAbsences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ placement_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH", "CO"], "detectCtAbsences");
    const { data: res, error } = await (context.supabase.rpc as any)("ct_detect_absences", {
      _placement_id: data.placement_id,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { events: number };
  });
