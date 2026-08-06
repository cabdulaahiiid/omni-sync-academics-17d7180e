import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThreadForSemester, replyFeedback, dhResubmitSemester, dhResubmitWeek } from "@/lib/feedback.functions";
import { listSemesterSessions, updateDraftSession } from "@/lib/semester-drafts.functions";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

type Msg = { id: string; thread_id: string; sender_id: string | null; message: string; created_at: string };

export function FeedbackChat({ semesterId, weekNum = null, title = "Feedback chat" }: { semesterId: string; weekNum?: number | null; title?: string }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getThreadForSemester);
  const replyFn = useServerFn(replyFeedback);
  const sessionsFn = useServerFn(listSemesterSessions);
  const updateFn = useServerFn(updateDraftSession);
  const resubmitFn = useServerFn(dhResubmitSemester);
  const resubmitWeekFn = useServerFn(dhResubmitWeek);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery({
    queryKey: ["feedback-thread", semesterId, weekNum],
    queryFn: () => fetchFn({ data: { semester_id: semesterId, week_num: weekNum } }),
    staleTime: 10000,
  });

  useEffect(() => {
    if (!data?.thread?.id) return;
    const ch = supabase
      .channel(`fb-${data.thread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "schedule_feedback_messages", filter: `thread_id=eq.${data.thread.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["feedback-thread", semesterId, weekNum] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [data?.thread?.id, qc, semesterId, weekNum]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const mut = useMutation({
    mutationFn: () => replyFn({ data: { thread_id: data!.thread!.id, message: text.trim() } }),
    onSuccess: () => { setText(""); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: semData, refetch: refetchSem } = useQuery({
    queryKey: ["semester-sessions", semesterId],
    queryFn: () => sessionsFn({ data: { semester_id: semesterId } }),
    staleTime: 10000,
  });
  const isFeedbackActive = semData?.semester?.distribution_status === "FEEDBACK_ACTIVE";
  const isDH = me?.roles?.includes?.("DH");

  const resubmit = useMutation({
    mutationFn: async () => {
      if (weekNum == null) await resubmitFn({ data: { semester_id: semesterId } });
      else await resubmitWeekFn({ data: { semester_id: semesterId, week_num: weekNum } });
    },
    onSuccess: () => { toast.success("Resubmitted to Admin"); refetchSem(); qc.invalidateQueries({ queryKey: ["semester-sessions", semesterId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.thread) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {title}</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground">No conversation yet.</p></CardContent>
      </Card>
    );
  }

  const messages = (data.messages ?? []) as Msg[];

  return (
    <div className="space-y-4">
    <Card className="rounded-2xl flex flex-col h-[480px]">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> {title}
          {semData?.semester?.distribution_status && (
            <Badge variant={isFeedbackActive ? "destructive" : "secondary"} className="ml-auto text-[10px]">
              {semData.semester.distribution_status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === me?.userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <p className="whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-3 space-y-2">
        <Textarea rows={2} placeholder="Type a reply…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" disabled={!text.trim() || mut.isPending} onClick={() => mut.mutate()}>
            <Send className="mr-2 h-4 w-4" /> {mut.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Card>

    {((weekNum != null && isDH) || (isFeedbackActive && isDH)) && (
      <Card className="rounded-2xl">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit sessions{weekNum != null ? ` — Week ${weekNum}` : ""} ({(semData?.sessions ?? []).filter((s: any) => weekNum == null || s.week_num === weekNum).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 max-h-[360px] overflow-y-auto">
          {(semData?.sessions ?? []).filter((s: any) => weekNum == null || s.week_num === weekNum).map((s: any) => (
            <SessionEditRow key={s.id} session={s}
              onSave={async (patch) => {
                await updateFn({ data: { schedule_id: s.id, patch } });
                toast.success("Session updated");
                refetchSem();
              }} />
          ))}
          {(semData?.sessions ?? []).filter((s: any) => weekNum == null || s.week_num === weekNum).length === 0 && (
            <p className="text-xs text-muted-foreground">No sessions in this level.</p>
          )}
        </CardContent>
        <div className="border-t p-3">
          <Button className="w-full" disabled={resubmit.isPending} onClick={() => resubmit.mutate()}>
            <Send className="mr-2 h-4 w-4" /> {resubmit.isPending ? "Submitting…" : weekNum != null ? `Re-submit Week ${weekNum}` : "Re-submit for Approval"}
          </Button>
        </div>
      </Card>
    )}
    </div>
  );
}

function SessionEditRow({ session, onSave }: { session: any; onSave: (patch: Record<string, string>) => Promise<void> }) {
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(session.start_time?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(session.end_time?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = date !== session.date || start !== session.start_time?.slice(0, 5) || end !== session.end_time?.slice(0, 5);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md border p-2">
      <div className="space-y-1">
        <p className="text-xs font-medium truncate">{session.module_code} · {session.module_name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{session.trainer_name} · Week {session.week_num}</p>
        <div className="flex gap-1.5">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" />
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-7 w-[90px] text-xs" />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-7 w-[90px] text-xs" />
        </div>
      </div>
      <Button size="sm" variant="outline" disabled={!dirty || saving}
        onClick={async () => {
          setSaving(true);
          try { await onSave({ date, start_time: start, end_time: end }); }
          finally { setSaving(false); }
        }}>
        <Save className="h-3 w-3" />
      </Button>
    </div>
  );
}