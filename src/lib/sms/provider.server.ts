/**
 * Provider-independent SMS sending layer.
 * Current implementation: SMS Ethiopia (smsethiopia.com).
 * To add another gateway, implement `SmsProvider` and select it in `getProvider()`.
 */
export type SmsResult = {
  ok: boolean;
  providerMessageId?: string | null;
  error?: string | null;
};

export type SmsProvider = {
  name: string;
  configured: boolean;
  environment: "development" | "production";
  baseUrl: string;
  senderId: string | null;
  source: "database" | "secrets";
  send: (to: string, message: string) => Promise<SmsResult>;
};

export const DEFAULT_BASE_URL = "https://api.smsethiopia.com/api/send";

export type GatewaySettings = {
  id: string | null;
  apiKey: string | null;
  senderId: string | null;
  environment: "development" | "production";
  prodBaseUrl: string;
  devBaseUrl: string;
  source: "database" | "secrets";
  updatedAt: string | null;
};

/** Database settings take precedence; project secrets are the fallback. */
export async function loadGatewaySettings(): Promise<GatewaySettings> {
  const envFallback: GatewaySettings = {
    id: null,
    apiKey: process.env["SMSETHIOPIA_API_KEY"] ?? null,
    senderId: process.env["SMSETHIOPIA_SENDER_ID"] ?? null,
    environment: "production",
    prodBaseUrl: (process.env["SMSETHIOPIA_BASE_URL"] || DEFAULT_BASE_URL).trim(),
    devBaseUrl: (process.env["SMSETHIOPIA_BASE_URL"] || DEFAULT_BASE_URL).trim(),
    source: "secrets",
    updatedAt: null,
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("sms_settings")
      .select("id, api_key, sender_id, environment, prod_base_url, dev_base_url, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return envFallback;
    const row = data as Record<string, any>;
    return {
      id: row["id"] as string,
      apiKey: (row["api_key"] as string | null) ?? envFallback.apiKey,
      senderId: (row["sender_id"] as string | null) ?? null,
      environment: row["environment"] === "development" ? "development" : "production",
      prodBaseUrl: (row["prod_base_url"] as string) || DEFAULT_BASE_URL,
      devBaseUrl: (row["dev_base_url"] as string) || DEFAULT_BASE_URL,
      source: "database",
      updatedAt: (row["updated_at"] as string | null) ?? null,
    };
  } catch {
    return envFallback;
  }
}

function buildProvider(s: GatewaySettings): SmsProvider {
  const apiKey = s.apiKey;
  const sender = s.senderId || undefined;
  const baseUrl = (s.environment === "development" ? s.devBaseUrl : s.prodBaseUrl).trim() || DEFAULT_BASE_URL;
  return {
    name: "smsethiopia",
    configured: Boolean(apiKey),
    environment: s.environment,
    baseUrl,
    senderId: s.senderId,
    source: s.source,
    async send(to, message) {
      if (!apiKey) return { ok: false, error: "SMS gateway is not configured" };
      try {
        const res = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            "X-API-KEY": apiKey,
          },
          body: JSON.stringify({
            api_key: apiKey,
            to,
            phone: to,
            message,
            msg: message,
            ...(sender ? { from: sender, sender_id: sender } : {}),
          }),
        });
        const text = await res.text();
        if (!res.ok) {
          console.error(`[sms] gateway ${res.status}: ${text}`);
          return { ok: false, error: `Gateway ${res.status}: ${text.slice(0, 300)}` };
        }
        let id: string | null = null;
        let failed: string | null = null;
        try {
          const body = JSON.parse(text) as Record<string, unknown>;
          id =
            (body["message_id"] as string) ??
            (body["messageId"] as string) ??
            (body["id"] as string) ??
            null;
          const okFlag = body["success"] ?? body["ok"] ?? body["status"];
          if (okFlag === false || okFlag === "failed" || okFlag === "error") {
            failed = String(body["message"] ?? body["error"] ?? text).slice(0, 300);
          }
        } catch {
          /* non-JSON success body is fine */
        }
        if (failed) return { ok: false, error: failed };
        return { ok: true, providerMessageId: id };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sms] send failed: ${msg}`);
        return { ok: false, error: msg };
      }
    },
  };
}

export async function getProvider(): Promise<SmsProvider> {
  return buildProvider(await loadGatewaySettings());
}

export function providerFromSettings(s: GatewaySettings): SmsProvider {
  return buildProvider(s);
}
