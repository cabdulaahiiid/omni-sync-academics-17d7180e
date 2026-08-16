import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";
import { normalizeEtPhone, PHONE_ERROR } from "@/lib/phone";

export type ContactGroup =
  | "DEPARTMENT_HEADS"
  | "TRAINERS"
  | "STUDENTS"
  | "PARENTS"
  | "OTHER_STAFF";

export const CONTACT_GROUPS: { id: ContactGroup; label: string }[] = [
  { id: "DEPARTMENT_HEADS", label: "Department Heads" },
  { id: "TRAINERS", label: "Trainers" },
  { id: "STUDENTS", label: "Students" },
  { id: "PARENTS", label: "Parents / Guardians" },
  { id: "OTHER_STAFF", label: "Other / Imported Staff" },
];

export const STAFF_GROUPS: ContactGroup[] = ["DEPARTMENT_HEADS", "TRAINERS", "OTHER_STAFF"];

export type Contact = {
  id: string;
  name: string;
  phone: string | null;
  group: ContactGroup;
  department_id: string | null;
  department_name: string;
  class_name: string | null;
  detail: string | null;
  status: "ACTIVE" | "INACTIVE";
  source_id: string;
};

/** Full contact book, assembled live from existing registrations. Admin only. */
export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "listContacts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: depts },
      { data: profiles },
      { data: roles },
      { data: trainers },
      { data: students },
      { data: levels },
      { data: sections },
      { data: external },
    ] = await Promise.all([
      supabaseAdmin.from("departments").select("id, name"),
      supabaseAdmin.from("profiles").select("id, full_name, email, phone, department_id, active"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("trainer_registry").select("id, full_name, phone, email, department_id, status"),
      supabaseAdmin
        .from("students")
        .select(
          "id, full_name, registration_number, level_id, section_id, department_id, status, parent_guardian_name, parent_guardian_telephone, parent_guardian_relationship",
        )
        .limit(5000),
      supabaseAdmin.from("levels").select("id, name, display_name"),
      supabaseAdmin.from("sections").select("id, name"),
      supabaseAdmin.from("external_contacts").select("*").order("full_name"),
    ]);

    const dMap = Object.fromEntries((depts ?? []).map((d) => [d.id, d.name]));
    const lMap = Object.fromEntries((levels ?? []).map((l: any) => [l.id, l.display_name || l.name]));
    const sMap = Object.fromEntries((sections ?? []).map((s) => [s.id, s.name]));
    const roleMap: Record<string, string[]> = {};
    for (const r of roles ?? []) (roleMap[r.user_id] = roleMap[r.user_id] ?? []).push(r.role as string);

    const out: Contact[] = [];

    // Department heads + admins (staff accounts)
    for (const p of profiles ?? []) {
      const rs = roleMap[p.id] ?? [];
      if (!rs.includes("DH") && !rs.includes("MA")) continue;
      out.push({
        id: `profile:${p.id}`,
        name: p.full_name,
        phone: normalizeEtPhone((p as any).phone),
        group: "DEPARTMENT_HEADS",
        department_id: p.department_id ?? null,
        department_name: p.department_id ? dMap[p.department_id] ?? "—" : "—",
        class_name: null,
        detail: rs.includes("MA") ? "Admin" : "Department Head",
        status: p.active ? "ACTIVE" : "INACTIVE",
        source_id: p.id,
      });
    }

    for (const t of trainers ?? []) {
      out.push({
        id: `trainer:${t.id}`,
        name: t.full_name,
        phone: normalizeEtPhone(t.phone),
        group: "TRAINERS",
        department_id: t.department_id ?? null,
        department_name: t.department_id ? dMap[t.department_id] ?? "—" : "—",
        class_name: null,
        detail: t.email ?? null,
        status: t.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        source_id: t.id,
      });
    }

    for (const s of students ?? []) {
      const cls = [lMap[s.level_id], sMap[s.section_id]].filter(Boolean).join(" · ") || null;
      out.push({
        id: `student:${s.id}`,
        name: s.full_name,
        phone: null,
        group: "STUDENTS",
        department_id: s.department_id ?? null,
        department_name: s.department_id ? dMap[s.department_id] ?? "—" : "—",
        class_name: cls,
        detail: s.registration_number,
        status: s.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        source_id: s.id,
      });
      if (s.parent_guardian_name || s.parent_guardian_telephone) {
        out.push({
          id: `parent:${s.id}`,
          name: s.parent_guardian_name || `Guardian of ${s.full_name}`,
          phone: normalizeEtPhone(s.parent_guardian_telephone),
          group: "PARENTS",
          department_id: s.department_id ?? null,
          department_name: s.department_id ? dMap[s.department_id] ?? "—" : "—",
          class_name: cls,
          detail: `${s.parent_guardian_relationship ?? "Guardian"} of ${s.full_name}`,
          status: s.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
          source_id: s.id,
        });
      }
    }

    for (const e of external ?? []) {
      out.push({
        id: `external:${e.id}`,
        name: e.full_name,
        phone: normalizeEtPhone(e.phone),
        group: "OTHER_STAFF",
        department_id: e.department_id ?? null,
        department_name: e.department_id ? dMap[e.department_id] ?? "—" : "—",
        class_name: null,
        detail: e.role_title ?? null,
        status: e.active ? "ACTIVE" : "INACTIVE",
        source_id: e.id,
      });
    }

    return {
      contacts: out,
      departments: (depts ?? []).map((d) => ({ id: d.id, name: d.name })),
      classes: Array.from(new Set(out.map((c) => c.class_name).filter(Boolean))) as string[],
    };
  });

const phoneField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((v) => normalizeEtPhone(v) !== null, { message: PHONE_ERROR })
  .transform((v) => normalizeEtPhone(v)!);

const ExternalContact = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1).max(160),
  phone: phoneField,
  role_title: z.string().trim().max(120).optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
});

export const upsertExternalContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExternalContact.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "upsertExternalContact");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      full_name: data.full_name,
      phone: data.phone,
      role_title: data.role_title ?? null,
      department_id: data.department_id ?? null,
      notes: data.notes ?? null,
      active: data.active ?? true,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("external_contacts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: dup } = await supabaseAdmin
        .from("external_contacts")
        .select("id")
        .eq("phone", data.phone)
        .eq("active", true)
        .maybeSingle();
      if (dup) throw new Error("A contact with this telephone already exists.");
      const { error } = await supabaseAdmin.from("external_contacts").insert(payload);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: data.id ? "CONTACT_UPDATED" : "CONTACT_ADDED",
      entity_type: "external_contacts",
      entity_id: data.id ?? null,
      after_state: { full_name: data.full_name, phone: data.phone },
    });
    return { ok: true };
  });

export const deleteExternalContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "deleteExternalContact");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("external_contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "CONTACT_DELETED",
      entity_type: "external_contacts",
      entity_id: data.id,
    });
    return { ok: true };
  });

export const importExternalContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              full_name: z.string().trim().max(160),
              phone: z.string().trim().max(40),
              role_title: z.string().trim().max(120).optional().nullable(),
              department: z.string().trim().max(120).optional().nullable(),
            }),
          )
          .min(1)
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "importExternalContacts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: depts }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("departments").select("id, name"),
      supabaseAdmin.from("external_contacts").select("phone").eq("active", true),
    ]);
    const dMap = new Map((depts ?? []).map((d) => [d.name.toLowerCase(), d.id as string]));
    const seen = new Set((existing ?? []).map((e) => e.phone as string));
    const errors: { row: number; reason: string }[] = [];
    const inserts: Record<string, unknown>[] = [];
    data.rows.forEach((r, i) => {
      if (!r.full_name) return errors.push({ row: i + 1, reason: "Missing name" });
      const phone = normalizeEtPhone(r.phone);
      if (!phone) return errors.push({ row: i + 1, reason: PHONE_ERROR });
      if (seen.has(phone)) return errors.push({ row: i + 1, reason: "Duplicate telephone" });
      seen.add(phone);
      inserts.push({
        full_name: r.full_name,
        phone,
        role_title: r.role_title || null,
        department_id: r.department ? dMap.get(r.department.toLowerCase()) ?? null : null,
        created_by: context.userId,
      });
    });
    let inserted = 0;
    if (inserts.length) {
      const { data: ins, error } = await supabaseAdmin.from("external_contacts").insert(inserts as any).select("id");
      if (error) throw new Error(error.message);
      inserted = ins?.length ?? 0;
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: context.userId,
        action_type: "CONTACT_IMPORT",
        entity_type: "external_contacts",
        after_state: { inserted, errors: errors.length },
      });
    }
    return { inserted, errors };
  });

/** Admin updates a staff account's telephone; the contact book reflects it live. */
export const updateStaffPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ profile_id: z.string().uuid(), phone: z.string().trim().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "updateStaffPhone");
    const phone = data.phone === "" ? null : normalizeEtPhone(data.phone);
    if (data.phone !== "" && !phone) throw new Error(PHONE_ERROR);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ phone } as any).eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin updates a trainer's telephone in the trainer registry. */
export const updateTrainerPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ trainer_id: z.string().uuid(), phone: z.string().trim().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "updateTrainerPhone");
    const phone = data.phone === "" ? null : normalizeEtPhone(data.phone);
    if (data.phone !== "" && !phone) throw new Error(PHONE_ERROR);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trainer_registry").update({ phone }).eq("id", data.trainer_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin updates a student's guardian telephone. */
export const updateGuardianPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ student_id: z.string().uuid(), phone: z.string().trim().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "updateGuardianPhone");
    const phone = data.phone === "" ? null : normalizeEtPhone(data.phone);
    if (data.phone !== "" && !phone) throw new Error(PHONE_ERROR);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("students")
      .update({ parent_guardian_telephone: phone })
      .eq("id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
