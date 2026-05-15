import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export const Route = createFileRoute("/_authenticated/strategic/settings")({
  component: () => (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight capitalize">settings</h1>
      <p className="text-sm text-muted-foreground">Coming in the next iteration.</p></div>
      <Card><CardHeader><CardTitle>Not yet implemented</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">This module ships in the next phase.</CardContent></Card>
    </div>
  ),
});
