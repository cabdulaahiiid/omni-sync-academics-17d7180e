import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  strategic: "Master Admin",
  operational: "Department Head",
  ground: "Trainer",
  approvals: "Approval Queue",
  audit: "Audit Logs",
  insights: "Insights",
  departments: "Departments",
  modules: "Modules",
  venues: "Venues",
  levels: "Levels",
  sections: "Sections",
  semesters: "Levels",
  "department-heads": "Department Heads",
  trainers: "Trainers",
  students: "Students",
  users: "Users & Roles",
  reports: "Reports",
  settings: "Settings",
  matrix: "Schedules",
  "semester-upload": "Schedule Builder",
  drafts: "Drafts",
  attendance: "Attendance",
  "live-monitor": "Live Monitoring",
  "cooperative-training": "Industrial Practical Training",
  requests: "Requests",
  supervisor: "Supervisor Queue",
  "program-director": "Director Review",
  placements: "Placements",
  logbooks: "Logbooks",
  supervision: "Supervision",
  evaluation: "Evaluation",
  gaps: "Skill Gaps",
  industry: "Industry Trainer",
  profile: "My Profile",
};

function pretty(seg: string) {
  if (LABELS[seg]) return LABELS[seg];
  if (seg.startsWith("$") || /^[0-9a-f-]{8,}$/i.test(seg)) return "Detail";
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
}

export function Breadcrumbs({ className }: { className?: string }) {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: pretty(seg),
    last: i === segments.length - 1,
  }));
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Home className="h-3 w-3" />
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 opacity-50" />
          {c.last ? (
            <span className="font-medium text-foreground">{c.label}</span>
          ) : (
            <Link to={c.href as string} className="hover:text-foreground">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}