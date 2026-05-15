import { useOfflineSync } from "@/hooks/use-offline-sync";
import { RefreshCw, AlertTriangle } from "lucide-react";

export function OfflineBanner() {
  const { online, pending, conflicts, syncing, flush } = useOfflineSync();
  if (pending === 0 && conflicts === 0) return null;
  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-background/95 px-4 py-2 text-xs shadow-lg backdrop-blur">
      {pending > 0 && (
        <span className="flex items-center gap-1 text-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {pending} pending
        </span>
      )}
      {conflicts > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {conflicts} conflict{conflicts > 1 ? "s" : ""}
        </span>
      )}
      {online && pending > 0 && (
        <button onClick={() => flush()} className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
          Sync now
        </button>
      )}
    </div>
  );
}