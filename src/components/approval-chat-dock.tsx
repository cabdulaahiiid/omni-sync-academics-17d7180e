import { useEffect, useState } from "react";
import { FeedbackChat } from "@/components/feedback-chat";
import { Button } from "@/components/ui/button";
import { Minus, X, MessageSquare, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApprovalChatDockProps {
  semesterId: string;
  weekNum?: number | null;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Floating, minimisable real-time approval discussion dock.
 * Minimise / expand / close / reopen states are persisted per (semester, week)
 * in localStorage so the dock survives navigation.
 */
export function ApprovalChatDock({ semesterId, weekNum = null, title, open, onOpenChange }: ApprovalChatDockProps) {
  const stateKey = `chatdock:${semesterId}:${weekNum ?? "sem"}`;
  const [minimized, setMinimized] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(stateKey) === "min";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(stateKey, minimized ? "min" : "open");
  }, [stateKey, minimized]);

  if (!open) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <MessageSquare className="h-4 w-4" /> {title}
      </button>
    );
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border bg-background shadow-2xl",
    )}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="truncate text-xs font-semibold">{title}</p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMinimized(true)} title="Minimise">
            <Minus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenChange(false)} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-2">
        <FeedbackChat semesterId={semesterId} weekNum={weekNum} title="" />
      </div>
    </div>
  );
}

/** Persistent floating "Reopen chat" pill when the dock was closed but a thread exists. */
export function ApprovalChatReopenPill({ onClick, label = "Open approval chat" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs shadow hover:bg-accent">
      <Maximize2 className="h-3.5 w-3.5" /> {label}
    </button>
  );
}