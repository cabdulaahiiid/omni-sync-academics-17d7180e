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
    const p = getProvider();
    return { provider: p.name, configured: p.configured };
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
    const provider = getProvider();

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

    let sent = 0;
    let failed = 0;
    const batchSize = 20;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (r) => {
          const body = data.message.replace(/\{Name\}/g, r.name ?? "");
          const res = await provider.send(r.phone, body);
          return { r, res };
        }),
      );
      const rows = results.map(({ r, res }) => {
        if (res.ok) sent += 1;
        else failed += 1;
        return {
          campaign_id: campaign.id,
          contact_name: r.name,
          phone: r.phone,
          source_group: r.group,
          status: res.ok ? "SENT" : "FAILED",
          provider_message_id: res.providerMessageId ?? null,
          error: res.error ?? null,
        };
      });
      await supabaseAdmin.from("sms_recipients").insert(rows);
    }

    await supabaseAdmin
      .from("sms_campaigns")
      .update({
        sent_count: sent,
        failed_count: failed,
        status: failed === 0 ? "COMPLETED" : sent === 0 ? "FAILED" : "PARTIAL",
      })
      .eq("id", campaign.id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action_type: "SMS_SENT",
      entity_type: "sms_campaigns",
      entity_id: campaign.id,
      after_state: { total: list.length, sent, failed, groups: data.groups },
    });

    return { campaign_id: campaign.id, total: list.length, sent, failed };
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
