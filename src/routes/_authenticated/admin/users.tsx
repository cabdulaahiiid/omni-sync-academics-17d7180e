import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Coming in the next iteration.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Module placeholder</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The Users management interface will be built using the same pattern as Departments.
        </CardContent>
      </Card>
    </div>
  );
}
