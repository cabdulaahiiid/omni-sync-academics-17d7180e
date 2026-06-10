import { Badge } from "@/components/ui/badge";

export interface ConflictBadgesProps {
  trainer?: boolean;
  venue?: boolean;
  qualification?: boolean;
  load?: boolean;
  size?: "default" | "sm";
  className?: string;
}

/**
 * Normalized destructive badges for workflow conflicts.
 * Used in the Approval Queue and any other approval surface that
 * surfaces scheduling conflicts.
 */
export function ConflictBadges({
  trainer,
  venue,
  qualification,
  load,
  size = "default",
  className,
}: ConflictBadgesProps) {
  const cls = size === "sm" ? "text-[10px]" : "";
  return (
    <div className={"flex flex-wrap gap-1 " + (className ?? "")}>
      {trainer && <Badge variant="destructive" className={cls}>Trainer conflict</Badge>}
      {venue && <Badge variant="destructive" className={cls}>Venue conflict</Badge>}
      {qualification && <Badge variant="destructive" className={cls}>Qualification</Badge>}
      {load && <Badge variant="destructive" className={cls}>Load</Badge>}
    </div>
  );
}