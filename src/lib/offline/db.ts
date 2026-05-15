import Dexie, { type Table } from "dexie";

export type OutboxStatus = "pending" | "syncing" | "synced" | "conflict" | "rejected";

export interface OutboxEntry {
  client_uuid: string;
  schedule_id: string;
  client_timestamp: string;
  lesson_plan: string;
  learning_outcome: string;
  latitude: number | null;
  longitude: number | null;
  attendance: { student_id: string; present: boolean }[];
  status: OutboxStatus;
  attempts: number;
  last_error?: string;
  conflict_reason?: string;
  created_at: number;
  updated_at: number;
}

export interface CachedSchedule {
  id: string;
  data: unknown;
  cached_at: number;
}

export interface CachedRoster {
  schedule_id: string;
  students: { id: string; full_name: string; registration_number: string }[];
  cached_at: number;
}

class OfflineDB extends Dexie {
  outbox!: Table<OutboxEntry, string>;
  schedules!: Table<CachedSchedule, string>;
  rosters!: Table<CachedRoster, string>;

  constructor() {
    super("tvet_offline");
    this.version(1).stores({
      outbox: "client_uuid, schedule_id, status, created_at",
      schedules: "id, cached_at",
      rosters: "schedule_id, cached_at",
    });
  }
}

let _db: OfflineDB | null = null;
export function offlineDB(): OfflineDB {
  if (typeof window === "undefined") {
    throw new Error("offlineDB only available in browser");
  }
  if (!_db) _db = new OfflineDB();
  return _db;
}