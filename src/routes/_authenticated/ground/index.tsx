import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/ground/")({
  component: () => (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground">Geo-fenced attendance and session check-ins.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The trainer mobile workflow (timetable, geo gate, attendance, session log) ships in the next iteration as a PWA.
        </CardContent>
      </Card>
    </div>
  ),
});