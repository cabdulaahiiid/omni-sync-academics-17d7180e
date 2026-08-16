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
  send: (to: string, message: string) => Promise<SmsResult>;
};

function smsEthiopiaProvider(): SmsProvider {
  const apiKey = process.env["SMSETHIOPIA_API_KEY"];
  const sender = process.env["SMSETHIOPIA_SENDER_ID"] || undefined;
  const baseUrl = (process.env["SMSETHIOPIA_BASE_URL"] || "https://api.smsethiopia.com/api/send").trim();
  return {
    name: "smsethiopia",
    configured: Boolean(apiKey),
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

export function getProvider(): SmsProvider {
  return smsEthiopiaProvider();
}
