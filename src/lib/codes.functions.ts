import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Next auto-generated registration code, e.g. ICT-26-0001
 * (department short code + two-digit year + running number).
 */
export const nextEntityCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["student", "trainer"]),
        department_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let deptId = data.department_id ?? null;
    if (!deptId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("department_id")
        .eq("id", userId)
        .maybeSingle();
      deptId = profile?.department_id ?? null;
    }
    if (!deptId) return { code: "" };
    const { data: code, error } = await supabase.rpc("next_entity_code", {
      _department_id: deptId,
      _kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return { code: (code as string) ?? "" };
  });
