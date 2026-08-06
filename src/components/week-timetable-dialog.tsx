import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getSemesterWeekTimetable, updateDraftSession, dhDeleteDraftSession } from "@/lib/level-drafts.functions";
import { listVenues } from "@/lib/data.functions";
import { listTrainers } from "@/lib/dh.functions";
import { useMe } from "@/hooks/use-me";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  semesterId: string;
  weekNum: number;
  title?: string;
};

export function WeekTimetableDialog({ open, onOpenChange, semesterId, weekNum, title }: Props) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isDH = me?.roles?.includes?.("DH");
  const fn = useServerFn(getSemesterWeekTimetable);
  const venuesFn = useServerFn(listVenues);
  const trainersFn = useServerFn(listTrainers);
  const updateFn = useServerFn(updateDraftSession);
  const deleteFn = useServerFn(dhDeleteDraftSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["level-week-timetable", semesterId, weekNum],
    queryFn: () => fn({ data: { semester_id: semesterId, week_num: weekNum } }),
    enabled: open,
  });
  const { data: venues } = useQuery({
    queryKey: ["venues-all"],
    queryFn: () => venuesFn(),
    enabled: open && isDH,
    staleTime: 60000,
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers-all"],
    queryFn: () => trainersFn(),
    enabled: open && isDH,
    staleTime: 60000,
  });
  const deptId = me?.profile?.department_id;
  const deptTrainers = (trainers ?? []).filter((t: any) => !deptId || t.department_id === deptId);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["level-week-timetable", semesterId, weekNum] });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { schedule_id: id } }),
    onSuccess: () => { toast.success("Session deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
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
                  {isDH && <TableHead className="w-[120px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r: any) => (
                  editingId === r.id ? (
                    <EditRow
                      key={r.id}
                      row={r}
                      venues={venues ?? []}
                      trainers={deptTrainers}
                      onCancel={() => setEditingId(null)}
                      onSave={async (patch) => {
                        await updateFn({ data: { schedule_id: r.id, patch } });
                        toast.success("Session updated");
                        setEditingId(null);
                        invalidate();
                      }}
                    />
                  ) : (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</TableCell>
                      <TableCell><span className="font-mono text-xs">{r.module_code}</span> · {r.module_name}</TableCell>
                      <TableCell>{r.section_name}</TableCell>
                      <TableCell>{r.venue_name}</TableCell>
                      <TableCell>{r.trainer_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      {isDH && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={r.status !== "DRAFT"}
                              title={r.status === "DRAFT" ? "Edit" : "Only DRAFT sessions can be edited"}
                              onClick={() => setEditingId(r.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              disabled={r.status !== "DRAFT" || delMut.isPending}
                              title={r.status === "DRAFT" ? "Delete" : "Only DRAFT sessions can be deleted"}
                              onClick={() => {
                                if (confirm(`Delete ${r.module_code} on ${r.date}?`)) delMut.mutate(r.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                ))}
                {(data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={isDH ? 8 : 7} className="text-center text-muted-foreground">No sessions.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {isDH && (
          <p className="text-[11px] text-muted-foreground">
            Edit/Delete is available on DRAFT sessions only. Submitted, approved, or live sessions are locked.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditRow({
  row,
  venues,
  trainers,
  onCancel,
  onSave,
}: {
  row: any;
  venues: any[];
  trainers: any[];
  onCancel: () => void;
  onSave: (patch: Record<string, string>) => Promise<void>;
}) {
  const [date, setDate] = useState<string>(row.date);
  const [start, setStart] = useState<string>(row.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState<string>(row.end_time?.slice(0, 5) ?? "");
  const [venueId, setVenueId] = useState<string>(row.venue_id ?? "");
  const [trainerId, setTrainerId] = useState<string>(row.trainer_registry_id ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <TableRow className="bg-accent/30">
      <TableCell>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-7 w-[80px] text-xs" />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-7 w-[80px] text-xs" />
        </div>
      </TableCell>
      <TableCell><span className="font-mono text-xs">{row.module_code}</span></TableCell>
      <TableCell>{row.section_name}</TableCell>
      <TableCell>
        <Select value={venueId} onValueChange={setVenueId}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Venue" /></SelectTrigger>
          <SelectContent>
            {venues.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={trainerId} onValueChange={setTrainerId}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Trainer" /></SelectTrigger>
          <SelectContent>
            {trainers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const patch: Record<string, string> = { date, start_time: start, end_time: end };
                if (venueId && venueId !== row.venue_id) patch.venue_id = venueId;
                if (trainerId && trainerId !== row.trainer_registry_id) patch.trainer_registry_id = trainerId;
                await onSave(patch);
              } finally { setSaving(false); }
            }}>
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}