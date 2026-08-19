import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ClipboardList, Building2, GraduationCap, BookOpen,
  ShieldCheck, Stethoscope, ClipboardCheck, Award, Settings2, TrendingDown,
} from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/erp/app-shell";
import { operationalNavFor } from "@/components/erp/operational-nav";
import { NavHeader } from "@/components/erp/nav-header";
import { canAccess, type ModuleKey } from "@/lib/auth/role-matrix";

type Tab = { to: string; label: string; icon: typeof LayoutDashboard; module: ModuleKey; end?: boolean };

const TABS: Tab[] = [
  { to: "/cooperative-training", label: "Overview", icon: LayoutDashboard, module: "ctOverview", end: true },
  { to: "/cooperative-training/requests", label: "Requests", icon: ClipboardList, module: "ctRequests" },
  { to: "/cooperative-training/supervisor", label: "Supervisor queue", icon: ShieldCheck, module: "ctSupervisorQueue" },
  { to: "/cooperative-training/program-director", label: "Director review", icon: ClipboardCheck, module: "ctDirectorReview" },
  { to: "/cooperative-training/placements", label: "Placements", icon: Building2, module: "ctPlacements" },
  { to: "/cooperative-training/logbooks", label: "Logbooks", icon: BookOpen, module: "ctLogbooks" },
  { to: "/cooperative-training/supervision", label: "Supervision", icon: Stethoscope, module: "ctSupervision" },
  { to: "/cooperative-training/evaluation", label: "Evaluation", icon: Award, module: "ctEvaluation" },
  { to: "/cooperative-training/reports", label: "Reports", icon: GraduationCap, module: "ctReports" },
  { to: "/cooperative-training/gaps", label: "Skill gaps", icon: TrendingDown, module: "ctGaps" },
  { to: "/cooperative-training/settings", label: "Department setup", icon: Settings2, module: "ctSettings" },
];

function CooperativeTrainingShell() {
  const { data: me } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const roles = (me?.roles ?? []) as string[];
  const tabs = TABS.filter((t) => canAccess(t.module, roles));

  return (
    <AppShell nav={operationalNavFor(me)}>
      <NavHeader
        title="Cooperative & Industrial Practical Training"
        description="Theory completion, enterprise placement, digital logbook, supervision and competency assessment."
      />
      <div className="rounded-xl border border-border/60 bg-card p-2">
        <nav className="flex flex-wrap gap-1" aria-label="Cooperative training sections">
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
      <div className="mt-4">
        <Outlet />
      </div>
    </AppShell>
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
