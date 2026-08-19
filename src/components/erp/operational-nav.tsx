import {
  LayoutDashboard, CalendarRange, Activity, FileBarChart, Upload,
  ClipboardCheck, GraduationCap, FileClock, HardHat,
} from "lucide-react";
import type { ShellNavItem } from "@/components/erp/app-shell";
import { canAccess, canEnterPracticalTraining } from "@/lib/auth/role-matrix";

export const OPERATIONAL_NAV: ShellNavItem[] = [
  { to: "/operational", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/operational/matrix", label: "Schedules", icon: CalendarRange },
  { to: "/operational/semester-upload", label: "Schedule Builder", icon: Upload },
  { to: "/operational/drafts", label: "Drafts", icon: FileClock },
  { to: "/operational/students", label: "Students Hub", icon: GraduationCap },
  { to: "/operational/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/operational/live-monitor", label: "Live Monitoring", icon: Activity },
  { to: "/operational/reports", label: "Reports", icon: FileBarChart },
];

export const PRACTICAL_TRAINING_NAV_ITEM: ShellNavItem = {
  to: "/cooperative-training",
  label: "Industrial Practical Training",
  icon: HardHat,
};

/**
 * Department-head navigation. Practical training is only surfaced for the
 * Industrial Department Head, admins, and the practical-training roles.
 */
export function operationalNavFor(me: any): ShellNavItem[] {
  const roles: string[] = me?.roles ?? [];
  const nav = [...OPERATIONAL_NAV];
  if (canEnterPracticalTraining(me)) nav.push(PRACTICAL_TRAINING_NAV_ITEM);
  if (canAccess("coordinatorDashboard", roles) && !roles.includes("DH")) {
    nav.push({ to: "/coordinator/dashboard", label: "Coordinator Hub", icon: HardHat });
  }
  return nav;
}
