import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getSemesterWeekTimetable } from "@/lib/semester-drafts.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  semesterId: string;
  weekNum: number;
  title?: string;
};

export function WeekTimetableDialog({ open, onOpenChange, semesterId, weekNum, title }: Props) {
  const fn = useServerFn(getSemesterWeekTimetable);
  const { data, isLoading } = useQuery({
    queryKey: ["semester-week-timetable", semesterId, weekNum],
    queryFn: () => fn({ data: { semester_id: semesterId, week_num: weekNum } }),
    enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title ?? `Week ${weekNum} timetable`}</DialogTitle>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.date}</TableCell>
                    <TableCell>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</TableCell>
                    <TableCell><span className="font-mono text-xs">{r.module_code}</span> · {r.module_name}</TableCell>
                    <TableCell>{r.section_name}</TableCell>
                    <TableCell>{r.venue_name}</TableCell>
                    <TableCell>{r.trainer_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {(data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No sessions.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}