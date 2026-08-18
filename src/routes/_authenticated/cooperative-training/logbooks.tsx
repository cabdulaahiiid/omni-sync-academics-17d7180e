import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCtWorkspace } from "@/hooks/use-ct-workspace";
import { DataTable, WorkspaceCard } from "@/components/ct/workspace-table";
import { EmptyState } from "@/components/erp/empty-state";
import { summariseLogbook } from "@/lib/ct/workspace-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function LogbooksPage() {
  const w = useCtWorkspace();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <WorkspaceCard
        title="Logbook monitoring"
        description="Daily entries per placement with hours logged against expected working days, plus overdue and absence flags."
      >
        {w.query.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading logbooks…</p>
        ) : w.placements.length === 0 ? (
          <EmptyState title="Nothing to monitor" description="Logbook activity appears once trainees start their placement." />
        ) : (
          <DataTable head={["Trainee", "Entries", "Hours", "Compliance", "Flags", ""]}>
            {w.placements.map((p: any) => {
              const entries = w.logbooksByPlacement.get(String(p.id)) ?? [];
              const s = summariseLogbook(entries, p);
              const absences = w.absencesByPlacement.get(String(p.id)) ?? [];
              const student = w.students.get(String(p.student_id));
              return (
                <tr key={p.id} className="border-t border-border/60 align-top">
                  <td className="p-2">
                    <p className="font-medium">{student?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{student?.registration_number ?? ""}</p>
                  </td>
                  <td className="p-2 text-xs">
                    {s.approved} approved · {s.submitted} waiting · {s.rejected} rejected · {s.draft} draft
                  </td>
                  <td className="p-2">{s.hours}h</td>
                  <td className="p-2">
                    <Badge variant={s.compliance >= 80 ? "secondary" : "outline"}>{s.compliance}%</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">{s.missingDays} day(s) missing</span>
                  </td>
                  <td className="p-2 text-xs">
                    {absences.length > 0 ? (
                      <Badge variant="destructive">{absences.length} absence event(s)</Badge>
                    ) : s.submitted > 0 ? (
                      <Badge variant="outline">Awaiting mentor approval</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                      {openId === p.id ? "Hide" : "View entries"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </WorkspaceCard>

      {openId && (
        <WorkspaceCard title="Logbook entries" description="Daily entries recorded by the trainee for the selected placement.">
          {(w.logbooksByPlacement.get(openId) ?? []).length === 0 ? (
            <EmptyState title="No entries" description="This trainee has not submitted any logbook day yet." />
          ) : (
            <DataTable head={["Date", "Task", "Hours", "Status"]}>
              {[...(w.logbooksByPlacement.get(openId) ?? [])]
                .sort((a: any, b: any) => String(b.entry_date).localeCompare(String(a.entry_date)))
                .map((e: any) => (
                  <tr key={e.id} className="border-t border-border/60">
                    <td className="p-2">{e.entry_date}</td>
                    <td className="p-2">{e.task_description}</td>
                    <td className="p-2">{Number(e.hours ?? 0)}h</td>
                    <td className="p-2"><Badge variant="outline">{e.status}</Badge></td>
                  </tr>
                ))}
            </DataTable>
          )}
        </WorkspaceCard>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/cooperative-training/logbooks")({
  head: () => ({
    meta: [
      { title: "Logbook Monitoring | Jigjiga Polytechnic ERP" },
      { name: "description", content: "Monitor trainee daily logbooks: hours logged, approvals, missing days and absence flags." },
      { property: "og:title", content: "Logbook Monitoring" },
      { property: "og:description", content: "Trainee logbook compliance, approvals and absence flags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LogbooksPage,
});
