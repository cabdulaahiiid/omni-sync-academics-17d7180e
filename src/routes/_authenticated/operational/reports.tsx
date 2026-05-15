import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  exportAttendanceCSV,
  exportSessionLogsCSV,
  exportTrainerVelocityCSV,
} from "@/lib/exports.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operational/reports")({
  component: ReportsPage,
});

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function ReportsPage() {
  const att = useServerFn(exportAttendanceCSV);
  const sess = useServerFn(exportSessionLogsCSV);
  const vel = useServerFn(exportTrainerVelocityCSV);

  const attM = useMutation({ mutationFn: () => att({ data: {} }), onSuccess: (r) => { downloadCSV(r.filename, r.csv); toast.success(`${r.count} rows exported`); }, onError: (e: Error) => toast.error(e.message) });
  const sessM = useMutation({ mutationFn: () => sess({ data: {} }), onSuccess: (r) => { downloadCSV(r.filename, r.csv); toast.success(`${r.count} rows exported`); }, onError: (e: Error) => toast.error(e.message) });
  const velM = useMutation({ mutationFn: () => vel({ data: {} }), onSuccess: (r) => { downloadCSV(r.filename, r.csv); toast.success(`${r.count} rows exported`); }, onError: (e: Error) => toast.error(e.message) });

  const items = [
    { title: "Attendance log (30d)", desc: "Per-student attendance with module + trainer.", run: () => attM.mutate(), pending: attM.isPending },
    { title: "Session logs (30d)", desc: "Lesson plans, learning outcomes, geo verification.", run: () => sessM.mutate(), pending: sessM.isPending },
    { title: "Trainer velocity (30d)", desc: "Scheduled vs completed sessions per trainer.", run: () => velM.mutate(), pending: velM.isPending },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate CSV exports for offline analysis.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">{it.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{it.desc}</p>
              <Button onClick={it.run} disabled={it.pending} className="w-full">
                <Download className="mr-2 h-4 w-4" /> {it.pending ? "Preparing…" : "Download CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}