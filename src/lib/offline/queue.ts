import { useServerFn } from "@tanstack/react-start";
import { offlineDB, type OutboxEntry } from "./db";
import { submitSessionBatch } from "@/lib/trainer.functions";

type SubmitFn = ReturnType<typeof useServerFn<typeof submitSessionBatch>>;

export type FlushReport = {
  attempted: number;
  applied: number;
  conflicts: number;
  rejected: number;
  errors: number;
};

export async function enqueueSessionBatch(entry: Omit<OutboxEntry, "status" | "attempts" | "created_at" | "updated_at">) {
  const db = offlineDB();
  const now = Date.now();
  await db.outbox.put({
    ...entry,
    status: "pending",
    attempts: 0,
    created_at: now,
    updated_at: now,
  });
}

export async function getOutboxCounts() {
  const db = offlineDB();
  const all = await db.outbox.toArray();
  return {
    pending: all.filter((e) => e.status === "pending" || e.status === "syncing").length,
    conflicts: all.filter((e) => e.status === "conflict").length,
    rejected: all.filter((e) => e.status === "rejected").length,
    total: all.length,
  };
}

export async function flushOutbox(submit: SubmitFn): Promise<FlushReport> {
  const db = offlineDB();
  const pending = await db.outbox.where("status").anyOf("pending").toArray();
  const report: FlushReport = { attempted: 0, applied: 0, conflicts: 0, rejected: 0, errors: 0 };

  for (const entry of pending) {
    report.attempted++;
    await db.outbox.update(entry.client_uuid, { status: "syncing", updated_at: Date.now() });
    try {
      const res = await submit({
        data: {
          client_uuid: entry.client_uuid,
          schedule_id: entry.schedule_id,
          client_timestamp: entry.client_timestamp,
          lesson_plan: entry.lesson_plan,
          learning_outcome: entry.learning_outcome,
          latitude: entry.latitude,
          longitude: entry.longitude,
          attendance: entry.attendance,
        },
      });
      if (res.status === "applied") {
        report.applied++;
        await db.outbox.update(entry.client_uuid, {
          status: "synced",
          updated_at: Date.now(),
          attempts: entry.attempts + 1,
        });
      } else if (res.status === "conflict") {
        report.conflicts++;
        await db.outbox.update(entry.client_uuid, {
          status: "conflict",
          conflict_reason: res.conflict_reason ?? "conflict",
          updated_at: Date.now(),
          attempts: entry.attempts + 1,
        });
      } else {
        report.rejected++;
        await db.outbox.update(entry.client_uuid, {
          status: "rejected",
          conflict_reason: res.conflict_reason ?? "rejected",
          updated_at: Date.now(),
          attempts: entry.attempts + 1,
        });
      }
    } catch (err) {
      report.errors++;
      const backoff = Math.min(60_000, 2000 * Math.pow(2, entry.attempts));
      await db.outbox.update(entry.client_uuid, {
        status: "pending",
        last_error: err instanceof Error ? err.message : String(err),
        attempts: entry.attempts + 1,
        updated_at: Date.now() + backoff,
      });
    }
  }
  return report;
}

export async function clearSynced() {
  const db = offlineDB();
  await db.outbox.where("status").equals("synced").delete();
}