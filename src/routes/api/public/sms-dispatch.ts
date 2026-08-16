import { createFileRoute } from "@tanstack/react-router";

async function dispatch() {
  const { runDueCampaigns } = await import("@/lib/sms/dispatch.server");
  try {
    const res = await runDueCampaigns();
    return Response.json({ ok: true, ...res });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Dispatch failed";
    console.error(`[sms-dispatch] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/sms-dispatch")({
  server: {
    handlers: {
      GET: async () => dispatch(),
      POST: async () => dispatch(),
    },
  },
});
