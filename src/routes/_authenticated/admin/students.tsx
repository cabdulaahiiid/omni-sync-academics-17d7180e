import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/students")({
  component: StudentsPage,
});

function StudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="text-sm text-muted-foreground">Coming in the next iteration.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Module placeholder</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The Students management interface will be built using the same pattern as Departments.
        </CardContent>
      </Card>
    </div>
  );
}
