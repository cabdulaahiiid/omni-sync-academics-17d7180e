import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEtPhone, PHONE_ERROR } from "@/lib/phone";

type GuardianAccess = { canView: boolean; sectionIds: string[] | null };

/** Resolve whether the caller may see guardian fields, and for which sections. */
async function guardianAccess(context: {
  supabase: any;
  userId: string;
}): Promise<GuardianAccess> {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles: string[] = (roleRows ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("MA") || roles.includes("DH")) return { canView: true, sectionIds: null };
  if (!roles.includes("T")) return { canView: false, sectionIds: [] };
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("trainer_registry_id")
    .eq("id", context.userId)
    .maybeSingle();
  const trainerId = profile?.trainer_registry_id;
  if (!trainerId) return { canView: false, sectionIds: [] };
  const { data: scheds } = await context.supabase
    .from("schedules")
    .select("section_id")
    .eq("trainer_registry_id", trainerId)
    .limit(2000);
  const sectionIds = Array.from(
    new Set((scheds ?? []).map((s: { section_id: string }) => s.section_id).filter(Boolean)),
  ) as string[];
  return { canView: sectionIds.length > 0, sectionIds };
}

/** List levels + sections in the current user's department for select dropdowns. */
export const listDeptLevelsSections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle();
    const deptId = profile?.department_id;
    if (!deptId) return { levels: [], sections: [] };
    const [{ data: levels }, { data: sections }] = await Promise.all([
      supabase.from("levels").select("id, name").eq("department_id", deptId).order("name"),
      supabase.from("sections").select("id, name, level_id").eq("department_id", deptId).order("name"),
    ]);
    return { levels: levels ?? [], sections: sections ?? [] };
  });

/** List students in the current DH's department (MA sees all). */
export const listMyStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guardianAccess(context as any);
    const { data, error } = await context.supabase
      .from("students")
      .select(
        "id, registration_number, full_name, gender, level_id, section_id, department_id, status, created_at, parent_guardian_name, parent_guardian_telephone, parent_guardian_relationship",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set([
      ...((data ?? []).map((s) => s.level_id).filter(Boolean) as string[]),
      ...((data ?? []).map((s) => s.section_id).filter(Boolean) as string[]),
    ]));
    const [{ data: levels }, { data: sections }] = await Promise.all([
      context.supabase.from("levels").select("id, name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      context.supabase.from("sections").select("id, name").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const lMap = Object.fromEntries((levels ?? []).map((l) => [l.id, l.name]));
    const sMap = Object.fromEntries((sections ?? []).map((s) => [s.id, s.name]));
    const rows = (data ?? []).map((s) => {
      const allowed =
        access.canView && (access.sectionIds === null || access.sectionIds.includes(s.section_id));
      const base = {
        ...s,
        level_name: lMap[s.level_id] ?? "—",
        section_name: sMap[s.section_id] ?? "—",
      };
      if (allowed) return base;
      return {
        ...base,
        parent_guardian_name: null,
        parent_guardian_telephone: null,
        parent_guardian_relationship: null,
      };
    });
    return { canViewGuardian: access.canView, students: rows };
  });

const RelationshipOptions = [
  "Father", "Mother", "Brother", "Sister", "Uncle", "Aunt",
  "Grandfather", "Grandmother", "Guardian", "Other",
] as const;

const StudentRow = z.object({
  registration_number: z.string().min(1).max(80),
  full_name: z.string().min(1).max(160),
  level_name: z.string().min(1).max(80),
  section_name: z.string().min(1).max(80),
  gender: z.string().max(20).optional().nullable(),
  parent_guardian_name: z.string().trim().max(160).optional().nullable(),
  parent_guardian_telephone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? null : normalizeEtPhone(v)))
    .refine((v, ) => v !== null || true, { message: PHONE_ERROR }),
  parent_guardian_relationship: z.enum(RelationshipOptions).optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.parent_guardian_telephone === null) return;
});

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StudentRow.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle();
    const deptId = profile?.department_id;
    if (!deptId) throw new Error("No department assigned");
    const { data: level } = await supabase.from("levels").select("id").eq("department_id", deptId).eq("name", data.level_name as any).maybeSingle();
    if (!level) throw new Error(`Unknown level '${data.level_name}'`);
    const { data: section } = await supabase.from("sections").select("id").eq("department_id", deptId).eq("level_id", level.id).eq("name", data.section_name).maybeSingle();
    if (!section) throw new Error(`Unknown section '${data.section_name}'`);
    const { data: row, error } = await supabase.from("students").insert({
      registration_number: data.registration_number,
      full_name: data.full_name,
      gender: data.gender ?? null,
      level_id: level.id,
      section_id: section.id,
      department_id: deptId,
      parent_guardian_name: data.parent_guardian_name ?? null,
      parent_guardian_telephone: data.parent_guardian_telephone ?? null,
      parent_guardian_relationship: data.parent_guardian_relationship ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId, action_type: "STUDENT_ADDED", entity_type: "students",
      entity_id: row.id, after_state: {
        registration_number: row.registration_number, full_name: row.full_name,
        level: data.level_name, section: data.section_name,
      },
    });
    return row;
  });

export const bulkInsertStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(StudentRow).min(1).max(5000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("department_id").eq("id", userId).maybeSingle();
    const deptId = profile?.department_id;
    if (!deptId) throw new Error("No department assigned");
    const [{ data: levels }, { data: sections }] = await Promise.all([
      supabase.from("levels").select("id, name").eq("department_id", deptId),
      supabase.from("sections").select("id, name, level_id").eq("department_id", deptId),
    ]);
    const lMap = new Map((levels ?? []).map((l) => [String(l.name).toLowerCase(), l.id as string]));
    const sMap = new Map((sections ?? []).map((s) => [`${s.level_id}|${String(s.name).toLowerCase()}`, s.id as string]));
    const errors: { row: number; reason: string }[] = [];
    type StudentInsert = {
      registration_number: string;
      full_name: string;
      gender: string | null;
      level_id: string;
      section_id: string;
      department_id: string;
    };
    const inserts: StudentInsert[] = [];
    data.rows.forEach((r, i) => {
      const lvl = lMap.get(r.level_name.toLowerCase());
      if (!lvl) { errors.push({ row: i + 1, reason: `Unknown level '${r.level_name}'` }); return; }
      const sec = sMap.get(`${lvl}|${r.section_name.toLowerCase()}`);
      if (!sec) { errors.push({ row: i + 1, reason: `Unknown section '${r.section_name}' for '${r.level_name}'` }); return; }
      inserts.push({
        registration_number: r.registration_number,
        full_name: r.full_name,
        gender: r.gender ?? null,
        level_id: lvl,
        section_id: sec,
        department_id: deptId,
      });
    });
    let inserted = 0;
    if (inserts.length) {
      const chunk = 500;
      for (let i = 0; i < inserts.length; i += chunk) {
        const slice = inserts.slice(i, i + chunk);
        const { error, data: ins } = await supabase.from("students").insert(slice).select("id");
        if (error) throw new Error(error.message);
        inserted += ins?.length ?? 0;
      }
    }
    if (inserted > 0) {
      await supabase.from("audit_logs").insert({
        actor_id: userId, action_type: "BULK_IMPORT", entity_type: "students",
        after_state: { inserted, errors: errors.length },
      });
    }
    return { inserted, errors };
  });