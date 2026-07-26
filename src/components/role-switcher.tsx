import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, GraduationCap, ShieldCheck } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

type Workspace = {
  role: "MA" | "DH" | "T";
  to: "/strategic" | "/operational" | "/ground";
  label: string;
  icon: typeof ShieldCheck;
};

const WORKSPACES: Workspace[] = [
  { role: "MA", to: "/strategic", label: "Admin", icon: ShieldCheck },
  { role: "DH", to: "/operational", label: "Dept Head", icon: Building2 },
  { role: "T", to: "/ground", label: "Trainer", icon: GraduationCap },
];

/**
 * Workspace switcher for users holding more than one role (e.g. a Department
 * Head who also teaches). Renders nothing for single-role users, so existing
 * layouts and permissions are unchanged.
 */
export function RoleSwitcher({ className }: { className?: string }) {
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const roles = (me?.roles ?? []) as string[];
  const available = WORKSPACES.filter((w) => roles.includes(w.role));
  if (available.length < 2) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border/60 bg-card p-0.5",
        className,
      )}
      role="navigation"
      aria-label="Switch workspace"
    >
      {available.map((w) => {
        const active = pathname.startsWith(w.to);
        const Icon = w.icon;
        return (
          <Link
            key={w.to}
            to={w.to}
            title={`${w.label} workspace`}
            aria-label={`${w.label} workspace`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{w.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
