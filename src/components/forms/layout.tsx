import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

/** Scrollable body for long dialogs — keeps header/footer fixed on small screens. */
export function FormBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-h-[65vh] space-y-5 overflow-y-auto px-1 py-1", className)}>
      {children}
    </div>
  );
}

/** A labelled group of related fields. */
export function FormSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      {title && (
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Responsive field grid: 1 column on mobile, 2 on >= sm. */
export function FormGrid({
  children,
  columns = 2,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", className)}>{children}</div>
  );
}

/** Field spanning the full grid width. */
export function FormFull({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

/** Inline error banner shown at the top of a form when a save fails. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
