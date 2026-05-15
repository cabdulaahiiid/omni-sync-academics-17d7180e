import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitSessionBatch } from "@/lib/trainer.functions";
import { flushOutbox, getOutboxCounts, clearSynced, type FlushReport } from "@/lib/offline/queue";

export function useOfflineSync() {
  const submit = useServerFn(submitSessionBatch);
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const c = await getOutboxCounts();
      setPending(c.pending);
      setConflicts(c.conflicts);
    } catch {
      /* SSR / no IDB */
    }
  }, []);

  const flush = useCallback(async (): Promise<FlushReport | null> => {
    if (!navigator.onLine) return null;
    setSyncing(true);
    try {
      const report = await flushOutbox(submit);
      await clearSynced();
      setLastSyncAt(Date.now());
      await refresh();
      return report;
    } finally {
      setSyncing(false);
    }
  }, [submit, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void flush();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVis);
    void refresh();
    void flush();
    const interval = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(interval);
    };
  }, [flush, refresh]);

  return { online, pending, conflicts, lastSyncAt, syncing, flush, refresh };
}