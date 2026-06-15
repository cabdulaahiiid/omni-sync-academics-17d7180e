import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/erp/status-badge";
import { MessageSquare, Send, Pencil, Save, Trash2, X, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getThreadForSemester, replyFeedback, dhResubmitWeek } from "@/lib/feedback.functions";
import {
  getSemesterWeekTimetable,
  updateDraftSession,
  dhDeleteDraftSession,
} from "@/lib/semester-drafts.functions";
import { listVenues } from "@/lib/data.functions";
import { listTrainers } from "@/lib/dh.functions";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  semesterId: string;
  weekNum: number;
  title?: string;
};

/**
 * Unified Week Feedback Workspace.
 * Combines the per-week chat thread with a full CRUD editor for that week's
 * DRAFT sessions, plus a single Resubmit-to-Admin action. Replaces the
 * separate FeedbackChat panel + WeekTimetableDialog flow used by DHs.
 */
export function WeekFeedbackWorkspace({ open, onOpenChange, semesterId, weekNum, title }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full p-0 sm:max-w-5xl flex flex-col h-full overflow-hidden"
      >
        <SheetTitle className="sr-only">{title ?? `Week ${weekNum} feedback`}</SheetTitle>
        <SheetDescription className="sr-only">
          Chat with Admin and edit draft sessions for this week.
        </SheetDescription>
        <WorkspaceBody
          semesterId={semesterId}
          weekNum={weekNum}
          title={title ?? `Week ${weekNum}`}
        />
      </SheetContent>
    </Sheet>
  );
}

function WorkspaceBody({ semesterId, weekNum, title }: { semesterId: string; weekNum: number; title: string }) {
  const { data: me } = useMe();
  const isDH = !!me?.roles?.includes?.("DH");
  const qc = useQueryClient();

  const tableFn = useServerFn(getSemesterWeekTimetable);
  const resubmitFn = useServerFn(dhResubmitWeek);

  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ["semester-week-timetable", semesterId, weekNum],
    queryFn: () => tableFn({ data: { semester_id: semesterId, week_num: weekNum } }),
  });

  // Aggregate status for the week header pill
  const aggregateStatus = (() => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const statuses = new Set(safeRows.map((r: any) => r?.status).filter(Boolean));
    if (statuses.has("LIVE") || statuses.has("ACTIVE")) return "LIVE";
    if (statuses.has("PENDING_MA")) return "PENDING_MA";
    if (statuses.has("DRAFT")) return "DRAFT";
    return [...statuses][0] ?? "DRAFT";
  })();

  const draftCount = (Array.isArray(rows) ? rows : []).filter((r: any) => r?.status === "DRAFT").length;
  const canResubmit = isDH && draftCount > 0;

  const resubmit = useMutation({
    mutationFn: () => resubmitFn({ data: { semester_id: semesterId, week_num: weekNum } }),
    onSuccess: (r: any) => {
      const n = r?.count ?? 0;
      toast.success(n > 0 ? `Resubmitted ${n} session(s) to Admin` : "Nothing new to resubmit");
      qc.invalidateQueries({ queryKey: ["semester-week-timetable", semesterId, weekNum] });
      qc.invalidateQueries({ queryKey: ["feedback-thread", semesterId, weekNum] });
      qc.invalidateQueries({ queryKey: ["week-feedback-threads"] });
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chatPanel = <ChatPanel semesterId={semesterId} weekNum={weekNum} />;
  const editorPanel = <EditorPanel semesterId={semesterId} weekNum={weekNum} rows={rows} isDH={isDH} />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="truncate text-sm font-semibold">{title} · Feedback</h2>
            <StatusBadge status={aggregateStatus} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Chat with Admin and edit DRAFT sessions for this week. Edits stay as drafts until you resubmit and Admin approves.
          </p>
        </div>
        {isDH && (
          <Button size="sm" disabled={!canResubmit || resubmit.isPending}
            onClick={() => {
              if (confirm(`Resubmit ${draftCount} draft session(s) for Week ${weekNum} to Admin?`)) resubmit.mutate();
            }}>
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", resubmit.isPending && "animate-spin")} />
            {resubmit.isPending ? "Resubmitting…" : "Resubmit to Admin"}
          </Button>
        )}
      </div>

      {/* Split-screen on lg, tabs below */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-h-0 border-r">{chatPanel}</div>
        <div className="min-h-0">{editorPanel}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-4 mt-3 grid w-[calc(100%-2rem)] grid-cols-2">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="edit">Edit timetable</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="min-h-0 flex-1">{chatPanel}</TabsContent>
          <TabsContent value="edit" className="min-h-0 flex-1">{editorPanel}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* -------------------- Chat panel -------------------- */

type Msg = { id: string; thread_id: string; sender_id: string | null; message: string; created_at: string };

function ChatPanel({ semesterId, weekNum }: { semesterId: string; weekNum: number }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getThreadForSemester);
  const replyFn = useServerFn(replyFeedback);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery({
    queryKey: ["feedback-thread", semesterId, weekNum],
    queryFn: () => fetchFn({ data: { semester_id: semesterId, week_num: weekNum } }),
    staleTime: 5000,
  });

  useEffect(() => {
    if (!data?.thread?.id) return;
    const ch = supabase
      .channel(`fb-ws-${data.thread.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "schedule_feedback_messages", filter: `thread_id=eq.${data.thread.id}` },
        () => qc.invalidateQueries({ queryKey: ["feedback-thread", semesterId, weekNum] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [data?.thread?.id, qc, semesterId, weekNum]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const send = useMutation({
    mutationFn: () => replyFn({ data: { thread_id: data!.thread!.id, message: text.trim() } }),
    onSuccess: () => { setText(""); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages = (data?.messages ?? []) as Msg[];
  const hasThread = !!data?.thread;
  const loading = data === undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <p className="mt-8 text-center text-xs text-muted-foreground">Loading conversation…</p>
        )}
        {!loading && !hasThread && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            No feedback from Admin yet for this week.
          </p>
        )}
        {!loading && hasThread && messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground">Conversation is empty.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me?.userId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                mine ? "bg-primary text-primary-foreground" : "bg-muted",
              )}>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-2 border-t p-3">
        <Textarea
          rows={2}
          placeholder={hasThread ? "Type a reply…" : "You can reply once Admin opens a thread."}
          value={text}
          disabled={!hasThread}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!hasThread || !text.trim() || send.isPending} onClick={() => send.mutate()}>
            <Send className="mr-2 h-3.5 w-3.5" /> {send.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Editor panel -------------------- */

function EditorPanel({
  semesterId, weekNum, rows, isDH,
}: { semesterId: string; weekNum: number; rows: any[]; isDH: boolean }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const venuesFn = useServerFn(listVenues);
  const trainersFn = useServerFn(listTrainers);
  const updateFn = useServerFn(updateDraftSession);
  const deleteFn = useServerFn(dhDeleteDraftSession);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: venues } = useQuery({
    queryKey: ["venues-all"], queryFn: () => venuesFn(), enabled: isDH, staleTime: 60_000,
  });
  const { data: trainers } = useQuery({
    queryKey: ["trainers-all"], queryFn: () => trainersFn(), enabled: isDH, staleTime: 60_000,
  });
  const deptId = me?.profile?.department_id;
  const deptTrainers = (trainers ?? []).filter((t: any) => !deptId || t.department_id === deptId);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["semester-week-timetable", semesterId, weekNum] });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { schedule_id: id } }),
    onSuccess: () => { toast.success("Session deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Section</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead>Trainer</TableHead>
              <TableHead>Status</TableHead>
              {isDH && <TableHead className="w-[100px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r: any) => {
              const locked = r.status !== "DRAFT";
              if (editingId === r.id && !locked) {
                return (
                  <EditRow key={r.id} row={r} venues={venues ?? []} trainers={deptTrainers}
                    onCancel={() => setEditingId(null)}
                    onSave={async (patch) => {
                      await updateFn({ data: { schedule_id: r.id, patch } });
                      toast.success("Session updated");
                      setEditingId(null);
                      invalidate();
                    }} />
                );
              }
              return (
                <TableRow key={r.id} className={cn(locked && "opacity-80")}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.start_time?.slice(0, 5)}–{r.end_time?.slice(0, 5)}</TableCell>
                  <TableCell><span className="font-mono text-xs">{r.module_code}</span> · {r.module_name}</TableCell>
                  <TableCell>{r.section_name}</TableCell>
                  <TableCell>{r.venue_name}</TableCell>
                  <TableCell>{r.trainer_name}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  {isDH && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          disabled={locked} title={locked ? "Locked — already submitted or approved" : "Edit"}
                          onClick={() => setEditingId(r.id)}>
                          {locked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          disabled={locked || del.isPending}
                          title={locked ? "Locked" : "Delete"}
                          onClick={() => {
                            if (confirm(`Delete ${r.module_code} on ${r.date}?`)) del.mutate(r.id);
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {(rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={isDH ? 8 : 7} className="text-center text-muted-foreground">
                  No sessions in this week.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {isDH && (
        <p className="border-t p-3 text-[11px] text-muted-foreground">
          Edits saved here become a new draft version for Week {weekNum}. They go live only after you Resubmit and Admin approves.
        </p>
      )}
    </div>
  );
}

function EditRow({
  row, venues, trainers, onCancel, onSave,
}: {
  row: any; venues: any[]; trainers: any[];
  onCancel: () => void; onSave: (patch: Record<string, string>) => Promise<void>;
}) {
  const [date, setDate] = useState<string>(row.date);
  const [start, setStart] = useState<string>(row.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState<string>(row.end_time?.slice(0, 5) ?? "");
  const [venueId, setVenueId] = useState<string | undefined>(row.venue_id ?? undefined);
  const [trainerId, setTrainerId] = useState<string | undefined>(row.trainer_registry_id ?? undefined);
  const [saving, setSaving] = useState(false);
  return (
    <TableRow className="bg-accent/30">
      <TableCell><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" /></TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-7 w-[80px] text-xs" />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-7 w-[80px] text-xs" />
        </div>
      </TableCell>
      <TableCell><span className="font-mono text-xs">{row.module_code}</span></TableCell>
      <TableCell>{row.section_name}</TableCell>
      <TableCell>
        <Select value={venueId || undefined} onValueChange={(v) => setVenueId(v || undefined)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Venue" /></SelectTrigger>
          <SelectContent>
            {(venues ?? []).filter((v: any) => v?.id).map((v: any) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={trainerId || undefined} onValueChange={(v) => setTrainerId(v || undefined)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Trainer" /></SelectTrigger>
          <SelectContent>
            {(trainers ?? []).filter((t: any) => t?.id).map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell><StatusBadge status={row.status} /></TableCell>
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