import type { SmsProvider } from "./provider.server";

export type DispatchRecipient = { name: string | null; phone: string; group: string | null };

/** Sends a campaign's recipients in batches and records per-recipient results. */
export async function dispatchCampaign(opts: {
  campaignId: string;
  message: string;
  recipients: DispatchRecipient[];
  provider: SmsProvider;
}): Promise<{ sent: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { campaignId, message, recipients, provider } = opts;

  let sent = 0;
  let failed = 0;
  const batchSize = 20;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (r) => {
        const body = message.replace(/\{Name\}/g, r.name ?? "");
        const res = await provider.send(r.phone, body);
        return { r, res };
      }),
    );
    const rows = results.map(({ r, res }) => {
      if (res.ok) sent += 1;
      else failed += 1;
      return {
        campaign_id: campaignId,
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
    .eq("id", campaignId);

  return { sent, failed };
}

/** Picks up every due scheduled campaign, claims it atomically and sends it. */
export async function runDueCampaigns(): Promise<{ processed: number; details: unknown[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getProvider } = await import("./provider.server");
  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabaseAdmin
    .from("sms_campaigns")
    .select("id, message, scheduled_at")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", nowIso)
    .limit(10);
  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return { processed: 0, details: [] };

  const provider = await getProvider();
  const details: unknown[] = [];

  for (const c of due) {
    // Atomic claim: only one worker can flip SCHEDULED -> SENDING.
    const { data: claimed } = await supabaseAdmin
      .from("sms_campaigns")
      .update({ status: "SENDING", claimed_at: new Date().toISOString(), environment: provider.environment })
      .eq("id", c.id)
      .eq("status", "SCHEDULED")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { data: planned } = await supabaseAdmin
      .from("sms_scheduled_recipients")
      .select("contact_name, phone, source_group")
      .eq("campaign_id", c.id);

    const list: DispatchRecipient[] = (planned ?? []).map((p: any) => ({
      name: p.contact_name ?? null,
      phone: p.phone as string,
      group: p.source_group ?? null,
    }));

    if (!provider.configured) {
      await supabaseAdmin.from("sms_recipients").insert(
        list.map((r) => ({
          campaign_id: c.id,
          contact_name: r.name,
          phone: r.phone,
          source_group: r.group,
          status: "FAILED",
          error: "SMS gateway is not configured",
        })),
      );
      await supabaseAdmin
        .from("sms_campaigns")
        .update({ status: "FAILED", failed_count: list.length, error: "SMS gateway is not configured" })
        .eq("id", c.id);
      details.push({ campaign_id: c.id, error: "not configured" });
      continue;
    }

    const res = await dispatchCampaign({ campaignId: c.id, message: c.message as string, recipients: list, provider });
    await supabaseAdmin.from("sms_scheduled_recipients").delete().eq("campaign_id", c.id);
    details.push({ campaign_id: c.id, ...res });
  }

  return { processed: details.length, details };
}
