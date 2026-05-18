import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGlobalConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("global_config")
      .select("id, attendance_window_minutes, geo_fence_radius, allow_offline_sync, campus_lat, campus_lng, campus_radius_m, updated_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateGlobalConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      attendance_window_minutes: z.number().int().min(0).max(120).optional(),
      campus_lat: z.number().min(-90).max(90).nullable().optional(),
      campus_lng: z.number().min(-180).max(180).nullable().optional(),
      campus_radius_m: z.number().min(10).max(5000).optional(),
      allow_offline_sync: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    if (id) {
      const { error } = await context.supabase.from("global_config").update({ ...patch, updated_by: context.userId }).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      // upsert single row
      const { data: existing } = await context.supabase.from("global_config").select("id").limit(1).maybeSingle();
      if (existing) {
        const { error } = await context.supabase.from("global_config").update({ ...patch, updated_by: context.userId }).eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase.from("global_config").insert({ ...patch, updated_by: context.userId });
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });