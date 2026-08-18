/**
 * Offline queue for industry-trainer daily logs. Uses the same Dexie database as
 * the trainer session outbox (separate table, one sync loop per kind) and is
 * idempotent through `client_uuid`.
 */
import { offlineDB, type CtDailyLogEntry } from "./db";

export type CtLogPayload = Omit<CtDailyLogEntry, "status" | "attempts" | "created_at" | "updated_at" | "last_error">;

export async function enqueueCtDailyLog(payload: CtLogPayload) {
  const db = offlineDB();
  const now = Date.now();
  await db.ctDailyLogs.put({ ...payload, status: "pending", attempts: 0, created_at: now, updated_at: now });
}

export async function getCtLogCounts() {
  const db = offlineDB();
  const all = await db.ctDailyLogs.toArray();
  return {
    pending: all.filter((e) => e.status === "pending" || e.status === "syncing").length,
    failed: all.filter((e) => e.status === "rejected").length,
    synced: all.filter((e) => e.status === "synced").length,
    total: all.length,
  };
}

type Submit = (args: { data: CtLogPayload }) => Promise<{ id: string; duplicate: boolean }>;

export async function flushCtDailyLogs(submit: Submit) {
  const db = offlineDB();
  const pending = await db.ctDailyLogs.where("status").anyOf("pending").toArray();
  let applied = 0;
  let failed = 0;
  for (const entry of pending) {
    await db.ctDailyLogs.update(entry.client_uuid, { status: "syncing", updated_at: Date.now() });
    try {
      const { status, attempts, created_at, updated_at, last_error, ...payload } = entry as CtDailyLogEntry;
      void status; void attempts; void created_at; void updated_at; void last_error;
      await submit({ data: payload as CtLogPayload });
      await db.ctDailyLogs.update(entry.client_uuid, { status: "synced", updated_at: Date.now() });
      applied++;
    } catch (e) {
      failed++;
      await db.ctDailyLogs.update(entry.client_uuid, {
        status: entry.attempts + 1 >= 5 ? "rejected" : "pending",
        attempts: entry.attempts + 1,
        last_error: e instanceof Error ? e.message : String(e),
        updated_at: Date.now(),
      });
    }
  }
  return { attempted: pending.length, applied, failed };
}

export async function clearSyncedCtLogs() {
  const db = offlineDB();
  const synced = await db.ctDailyLogs.where("status").equals("synced").toArray();
  await db.ctDailyLogs.bulkDelete(synced.map((s) => s.client_uuid));
}
