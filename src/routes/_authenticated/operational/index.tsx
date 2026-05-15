import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/operational/")({
  component: () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operational Command Center</h1>
        <p className="text-sm text-muted-foreground">Live monitoring, scheduling, and trainer operations.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The Department Head workspace (live monitor, quick swap, upload center, progress tracking) is scheduled for the next iteration.
        </CardContent>
      </Card>
    </div>
  ),
});