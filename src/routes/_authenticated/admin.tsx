import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminShell,
});