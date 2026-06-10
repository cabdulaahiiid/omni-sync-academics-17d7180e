import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RejectFeedbackDialog } from "@/components/erp/reject-feedback-dialog";

export interface ApprovalActionsProps {
  onApprove: () => void;
  onReject: (feedback: string) => void;
  isPending?: boolean;
  disabled?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
  entityName?: string;
  rejectTitle?: string;
  rejectDescription?: string;
  size?: "default" | "sm";
  className?: string;
  extraActions?: React.ReactNode;
}

/**
 * Standard Approve / Reject-with-feedback action cluster used across
 * every approval surface (Approval Queue, MA dashboard, DH leave reviews, etc.).
 * Approve fires immediately; Reject opens the shared feedback dialog and
 * requires a non-empty message.
 */
export function ApprovalActions({
  onApprove,
  onReject,
  isPending = false,
  disabled = false,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  entityName,
  rejectTitle,
  rejectDescription,
  size = "default",
  className,
  extraActions,
}: ApprovalActionsProps) {
  const [open, setOpen] = useState(false);
  const btnSize = size === "sm" ? "sm" : "default";
  const btnClass = size === "sm" ? "h-7 px-2 text-xs" : "";

  return (
    <div className={"flex flex-wrap items-center gap-2 " + (className ?? "")}>
      <Button
        size={btnSize}
        className={btnClass}
        disabled={disabled || isPending}
        onClick={onApprove}
      >
        {approveLabel}
      </Button>
      <Button
        size={btnSize}
        variant="destructive"
        className={btnClass}
        disabled={disabled || isPending}
        onClick={() => setOpen(true)}
      >
        {rejectLabel}
      </Button>
      {extraActions}
      <RejectFeedbackDialog
        open={open}
        onOpenChange={setOpen}
        entityName={entityName}
        title={rejectTitle}
        description={rejectDescription}
        isPending={isPending}
        onSubmit={(msg) => {
          onReject(msg);
          setOpen(false);
        }}
      />
    </div>
  );
}