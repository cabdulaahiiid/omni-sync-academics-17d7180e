import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";
import { normalizeEtPhone } from "@/lib/phone";

/** Enterprises with their mentors, sites, occupations and live occupancy. */
export const listCtEnterprises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [enterprises, contacts, sites, links, placements] = await Promise.all([
      supabase
        .from("ct_enterprises")
        .select("id, name, code, sector, address, phone, email, latitude, longitude, allowed_radius_meters, max_capacity, active")
        .order("name"),
      supabase
        .from("ct_enterprise_contacts")
        .select("id, enterprise_id, user_id, full_name, role_title, phone, email, is_primary, active")
        .order("full_name"),
      supabase
        .from("ct_enterprise_training_sites")
        .select("id, enterprise_id, name, location, rehabilitation_work, senior_engineer, latitude, longitude, allowed_radius_meters, max_capacity, active")
        .order("name"),
      supabase.from("ct_enterprise_occupations").select("enterprise_id, occupation_id"),
      supabase.from("ct_student_placements").select("enterprise_id, status").in("status", ["PENDING", "CONFIRMED", "ACTIVE"]),
    ]);
    const used = new Map<string, number>();
    for (const p of placements.data ?? []) {
      used.set(p.enterprise_id, (used.get(p.enterprise_id) ?? 0) + 1);
    }
    return {
      enterprises: (enterprises.data ?? []).map((e) => ({ ...e, occupied: used.get(e.id) ?? 0 })),
      contacts: contacts.data ?? [],
      sites: sites.data ?? [],
      links: links.data ?? [],
    };
  });

const enterpriseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().max(30).optional().nullable(),
  sector: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  allowed_radius_meters: z.number().min(20).max(5000).default(200),
  max_capacity: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
  occupation_ids: z.array(z.string().uuid()).default([]),
});

export const saveCtEnterprise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enterpriseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtEnterprise");
    const { supabase, userId } = context;
    const { id, occupation_ids, phone, email, ...rest } = data;
    const row = {
      ...rest,
      phone: phone ? normalizeEtPhone(phone) : null,
      email: email ? email : null,
    };
    let enterpriseId = id;
    if (id) {
      const { error } = await supabase.from("ct_enterprises").update({ ...row, updated_by: userId }).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("ct_enterprises")
        .insert({ ...row, created_by: userId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      enterpriseId = created.id;
    }
    if (enterpriseId) {
      await supabase.from("ct_enterprise_occupations").delete().eq("enterprise_id", enterpriseId);
      if (occupation_ids.length) {
        const { error } = await supabase
          .from("ct_enterprise_occupations")
          .insert(occupation_ids.map((occupation_id) => ({ enterprise_id: enterpriseId!, occupation_id })));
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true, id: enterpriseId };
  });

const contactSchema = z.object({
  id: z.string().uuid().optional(),
  enterprise_id: z.string().uuid(),
  user_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().min(2).max(120),
  role_title: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  is_primary: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const saveCtEnterpriseContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtEnterpriseContact");
    const { id, phone, email, ...rest } = data;
    const row = { ...rest, phone: normalizeEtPhone(phone), email: email ? email : null };
    const { error } = id
      ? await context.supabase.from("ct_enterprise_contacts").update({ ...row, updated_by: context.userId }).eq("id", id)
      : await context.supabase.from("ct_enterprise_contacts").insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const siteSchema = z.object({
  id: z.string().uuid().optional(),
  enterprise_id: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  location: z.string().trim().max(200).optional().nullable(),
  rehabilitation_work: z.string().trim().max(200).optional().nullable(),
  senior_engineer: z.string().trim().max(120).optional().nullable(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  allowed_radius_meters: z.number().min(20).max(5000).nullable().optional(),
  max_capacity: z.number().int().min(0).max(1000).nullable().optional(),
  active: z.boolean().default(true),
});

export const saveCtTrainingSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => siteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA", "DH"], "saveCtTrainingSite");
    const { id, ...row } = data;
    const { error } = id
      ? await context.supabase.from("ct_enterprise_training_sites").update({ ...row, updated_by: context.userId }).eq("id", id)
      : await context.supabase.from("ct_enterprise_training_sites").insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
