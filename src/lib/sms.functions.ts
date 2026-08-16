import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireRole } from "@/lib/auth/require-role";
import { normalizeEtPhone } from "@/lib/phone";

const Recipient = z.object({
  name: z.string().max(160).optional().nullable(),
  phone: z.string().max(40),
  group: z.string().max(40).optional().nullable(),
});

export const getSmsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "getSmsStatus");
    const { getProvider } = await import("@/lib/sms/provider.server");
    const p = await getProvider();
    return {
      provider: p.name,
      configured: p.configured,
      environment: p.environment,
      source: p.source,
    };
  });

/* ---------------- Gateway settings ---------------- */

export const getSmsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "getSmsSettings");
    const { loadGatewaySettings } = await import("@/lib/sms/provider.server");
    const s = await loadGatewaySettings();
    const key = s.apiKey ?? "";
    return {
      id: s.id,
      api_key_hint: key ? `••••${key.slice(-4)}` : null,
      has_api_key: Boolean(key),
      sender_id: s.senderId,
      environment: s.environment,
      prod_base_url: s.prodBaseUrl,
      dev_base_url: s.devBaseUrl,
      source: s.source,
      updated_at: s.updatedAt,
    };
  });

export const updateSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        api_key: z.string().trim().max(400).optional().nullable(),
        sender_id: z.string().trim().max(60).optional().nullable(),
        environment: z.enum(["development", "production"]),
        prod_base_url: z.string().trim().url().max(400),
        dev_base_url: z.string().trim().url().max(400),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "updateSmsSettings");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      sender_id: string | null;
      environment: string;
      prod_base_url: string;
      dev_base_url: string;
      updated_by: string;
      updated_at: string;
      api_key?: string;
    } = {
      sender_id: data.sender_id || null,
      environment: data.environment,
      prod_base_url: data.prod_base_url,
      dev_base_url: data.dev_base_url,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.api_key) patch.api_key = data.api_key;

    const { data: existing } = await supabaseAdmin
      .from("sms_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin.from("sms_settings").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("sms_settings").insert(patch);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "SMS_SETTINGS_UPDATED",
      entity_type: "sms_settings",
      after_state: {
        environment: data.environment,
        sender_id: data.sender_id || null,
        api_key_changed: Boolean(data.api_key),
      },
    });
    return { ok: true };
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().max(40), message: z.string().trim().min(1).max(320) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "sendTestSms");
    const phone = normalizeEtPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Ethiopian telephone number.");
    const { getProvider } = await import("@/lib/sms/provider.server");
    const provider = await getProvider();
    if (!provider.configured) throw new Error("SMS gateway is not configured.");
    const res = await provider.send(phone, data.message);
    return {
      ok: res.ok,
      environment: provider.environment,
      response: res.ok ? (res.providerMessageId ?? "Accepted by gateway") : (res.error ?? "Unknown error"),
    };
  });

export const sendSmsCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(1000),
        groups: z.array(z.string().max(40)).max(20).default([]),
        recipients: z.array(Recipient).min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "sendSmsCampaign");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getProvider } = await import("@/lib/sms/provider.server");
    const provider = await getProvider();

    // Normalize + de-duplicate by phone
    const unique = new Map<string, { name: string | null; phone: string; group: string | null }>();
    for (const r of data.recipients) {
      const phone = normalizeEtPhone(r.phone);
      if (!phone || unique.has(phone)) continue;
      unique.set(phone, { name: r.name ?? null, phone, group: r.group ?? null });
    }
    const list = Array.from(unique.values());
    if (list.length === 0) throw new Error("No valid telephone numbers in the selection.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("sms_campaigns")
      .insert({
        sender_id: context.userId,
        sender_name: profile?.full_name ?? null,
        message: data.message,
        groups: data.groups,
        total_recipients: list.length,
        environment: provider.environment,
        status: provider.configured ? "SENDING" : "FAILED",
        error: provider.configured ? null : "SMS gateway is not configured",
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    if (!provider.configured) {
      await supabaseAdmin.from("sms_recipients").insert(
        list.map((r) => ({
          campaign_id: campaign.id,
          contact_name: r.name,
          phone: r.phone,
          source_group: r.group,
          status: "FAILED",
          error: "SMS gateway is not configured",
        })),
      );
      await supabaseAdmin
        .from("sms_campaigns")
        .update({ failed_count: list.length })
        .eq("id", campaign.id);
      throw new Error("SMS gateway is not configured.");
    }

    const { dispatchCampaign } = await import("@/lib/sms/dispatch.server");
    const { sent, failed } = await dispatchCampaign({
      campaignId: campaign.id,
      message: data.message,
      recipients: list,
      provider,
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "SMS_SENT",
      entity_type: "sms_campaigns",
      entity_id: campaign.id,
      after_state: { total: list.length, sent, failed, groups: data.groups },
    });

    return { campaign_id: campaign.id, total: list.length, sent, failed };
  });

/* ---------------- Scheduled campaigns ---------------- */

export const scheduleSmsCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        message: z.string().trim().min(1).max(1000),
        groups: z.array(z.string().max(40)).max(20).default([]),
        recipients: z.array(Recipient).min(1).max(2000),
        scheduled_at: z.string().datetime(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "scheduleSmsCampaign");
    const when = new Date(data.scheduled_at);
    if (Number.isNaN(when.getTime())) throw new Error("Invalid schedule date/time.");
    if (when.getTime() < Date.now() - 60_000) throw new Error("Choose a date and time in the future.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getProvider } = await import("@/lib/sms/provider.server");
    const provider = await getProvider();

    const unique = new Map<string, { name: string | null; phone: string; group: string | null }>();
    for (const r of data.recipients) {
      const phone = normalizeEtPhone(r.phone);
      if (!phone || unique.has(phone)) continue;
      unique.set(phone, { name: r.name ?? null, phone, group: r.group ?? null });
    }
    const list = Array.from(unique.values());
    if (list.length === 0) throw new Error("No valid telephone numbers in the selection.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("sms_campaigns")
      .insert({
        sender_id: context.userId,
        sender_name: profile?.full_name ?? null,
        message: data.message,
        groups: data.groups,
        total_recipients: list.length,
        environment: provider.environment,
        scheduled_at: when.toISOString(),
        status: "SCHEDULED",
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    const { error: rErr } = await supabaseAdmin.from("sms_scheduled_recipients").insert(
      list.map((r) => ({
        campaign_id: campaign.id,
        contact_name: r.name,
        phone: r.phone,
        source_group: r.group,
      })),
    );
    if (rErr) throw new Error(rErr.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "SMS_SCHEDULED",
      entity_type: "sms_campaigns",
      entity_id: campaign.id,
      after_state: { total: list.length, scheduled_at: when.toISOString(), groups: data.groups },
    });

    return { campaign_id: campaign.id, total: list.length, scheduled_at: when.toISOString() };
  });

export const cancelScheduledCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "cancelScheduledCampaign");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sms_campaigns")
      .update({ status: "CANCELLED" })
      .eq("id", data.campaign_id)
      .eq("status", "SCHEDULED")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This batch is no longer pending, so it can't be cancelled.");
    await supabaseAdmin.from("sms_scheduled_recipients").delete().eq("campaign_id", data.campaign_id);
    return { ok: true };
  });

export const rescheduleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ campaign_id: z.string().uuid(), scheduled_at: z.string().datetime() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "rescheduleCampaign");
    const when = new Date(data.scheduled_at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      throw new Error("Choose a date and time in the future.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sms_campaigns")
      .update({ scheduled_at: when.toISOString() })
      .eq("id", data.campaign_id)
      .eq("status", "SCHEDULED")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This batch is no longer pending, so it can't be rescheduled.");
    return { ok: true, scheduled_at: when.toISOString() };
  });

export const listSmsCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireRole(context, ["MA"], "listSmsCampaigns");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("sms_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSmsRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ campaign_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireRole(context, ["MA"], "listSmsRecipients");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("sms_recipients")
      .select("*")
      .eq("campaign_id", data.campaign_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
