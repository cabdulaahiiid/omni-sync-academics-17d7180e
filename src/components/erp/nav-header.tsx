import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/erp/breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Uniform secondary header used on module screens: back button, breadcrumb
 * stack, page title and a slot for status badges / actions.
 */
export function NavHeader({
  title,
  description,
  actions,
  showBack = true,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  showBack?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const canGoBack = router.history.canGoBack();
  return (
    <div className={cn("mb-4 space-y-2", className)}>
      <div className="flex items-center gap-2">
        {showBack && canGoBack && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => router.history.back()}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        )}
        <Breadcrumbs />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
