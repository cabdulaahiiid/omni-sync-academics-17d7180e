import { createFileRoute } from "@tanstack/react-router";
import { StrategicShell } from "@/components/strategic/strategic-shell";

export const Route = createFileRoute("/_authenticated/strategic")({
  component: StrategicShell,
});