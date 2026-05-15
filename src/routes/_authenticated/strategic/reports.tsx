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

export const Route = createFileRoute("/_authenticated/strategic/reports")({
  component: StrategicReports,
});

function dl(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function StrategicReports() {
  const att = useServerFn(exportAttendanceCSV);
  const sess = useServerFn(exportSessionLogsCSV);
  const vel = useServerFn(exportTrainerVelocityCSV);

  const make = (fn: () => Promise<{ filename: string; csv: string; count: number }>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (r) => { dl(r.filename, r.csv); toast.success(`${r.count} rows exported`); },
      onError: (e: Error) => toast.error(e.message),
    });

  const a = make(() => att({ data: {} }));
  const s = make(() => sess({ data: {} }));
  const v = make(() => vel({ data: {} }));

  const items = [
    { title: "Attendance (30d)", desc: "Institution-wide attendance log.", m: a },
    { title: "Session logs (30d)", desc: "All session submissions with LO + lesson plan.", m: s },
    { title: "Trainer velocity (30d)", desc: "Scheduled vs completed by trainer.", m: v },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & Exports</h1>
        <p className="text-sm text-muted-foreground">Institutional CSV exports.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">{it.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{it.desc}</p>
              <Button onClick={() => it.m.mutate()} disabled={it.m.isPending} className="w-full">
                <Download className="mr-2 h-4 w-4" /> {it.m.isPending ? "Preparing…" : "Download CSV"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}