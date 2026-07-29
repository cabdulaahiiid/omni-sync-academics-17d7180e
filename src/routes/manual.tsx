import { createFileRoute } from "@tanstack/react-router";
import { ManualLayout } from "@/components/manual/manual-layout";

export const Route = createFileRoute("/manual")({
  component: ManualLayout,
});