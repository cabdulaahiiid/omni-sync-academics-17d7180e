import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ClipboardList, Building2, GraduationCap, BookOpen,
  ShieldCheck, Stethoscope, ClipboardCheck, HardHat, Award,
} from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; roles: string[]; end?: boolean };

const TABS: Tab[] = [
  { to: "/cooperative-training", label: "Overview", icon: LayoutDashboard, roles: ["MA", "DH", "IPS", "PD", "CO", "VT", "T", "EM", "TR"], end: true },
  { to: "/cooperative-training/requests", label: "Requests", icon: ClipboardList, roles: ["MA", "DH", "IPS"] },
  { to: "/cooperative-training/supervisor", label: "Supervisor queue", icon: ShieldCheck, roles: ["MA", "IPS"] },
  { to: "/cooperative-training/program-director", label: "Director review", icon: ClipboardCheck, roles: ["MA", "PD"] },
  { to: "/cooperative-training/placements", label: "Placements", icon: Building2, roles: ["MA", "IPS", "PD", "DH", "T", "VT"] },
  { to: "/cooperative-training/logbooks", label: "Logbooks", icon: BookOpen, roles: ["MA", "IPS", "PD", "T", "VT"] },
  { to: "/cooperative-training/supervision", label: "Supervision", icon: Stethoscope, roles: ["MA", "IPS", "PD", "T", "VT"] },
  { to: "/cooperative-training/evaluation", label: "Evaluation", icon: Award, roles: ["MA", "IPS", "PD", "T", "VT"] },
  { to: "/cooperative-training/reports", label: "Reports", icon: GraduationCap, roles: ["MA", "IPS", "PD"] },
];

function CooperativeTrainingShell() {
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const roles = (me?.roles ?? []) as string[];
  const tabs = TABS.filter((t) => t.roles.some((r) => roles.includes(r)));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">Cooperative &amp; Industrial Practical Training</h1>
          <p className="text-xs text-muted-foreground">
            Theory completion, enterprise placement, digital logbook, supervision and competency assessment.
          </p>
          <nav className="mt-3 flex flex-wrap gap-1" aria-label="Cooperative training sections">
            {tabs.map((t) => {
              const active = t.end ? pathname === t.to : pathname.startsWith(t.to);
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training")({
  head: () => ({
    meta: [
      { title: "Cooperative Training | Jigjiga Polytechnic ERP" },
      {
        name: "description",
        content:
          "Manage industrial practical training: placements, digital logbooks, supervision visits and competency evaluation.",
      },
      { property: "og:title", content: "Cooperative & Industrial Practical Training" },
      { property: "og:description", content: "Enterprise placements, logbooks, supervision and competency assessment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CooperativeTrainingShell,
});
