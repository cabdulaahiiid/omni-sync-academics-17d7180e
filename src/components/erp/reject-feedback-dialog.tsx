import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface RejectFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName?: string;
  title?: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  isPending?: boolean;
  minLength?: number;
  initialMessage?: string;
  onSubmit: (message: string) => void;
}

/**
 * Canonical reject-with-feedback dialog used everywhere the workflow
 * sends an item back to its originator. Feedback is required.
 */
export function RejectFeedbackDialog({
  open,
  onOpenChange,
  entityName,
  title,
  description,
  placeholder = "Required feedback message (what needs to change?)",
  submitLabel = "Send feedback & reject",
  isPending = false,
  minLength = 3,
  initialMessage = "",
  onSubmit,
}: RejectFeedbackDialogProps) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (open) setMessage(initialMessage);
  }, [open, initialMessage]);

  const heading = title ?? (entityName ? `Reject: ${entityName}` : "Reject");
  const helper =
    description ??
    "The originator will receive your feedback, the item will unlock for edits, and a notification will be sent.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{helper}</p>
          <Textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={message.trim().length < minLength || isPending}
            onClick={() => onSubmit(message.trim())}
          >
            {isPending ? "Sending…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}