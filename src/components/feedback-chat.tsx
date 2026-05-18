import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThreadForSemester, replyFeedback } from "@/lib/feedback.functions";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Msg = { id: string; thread_id: string; sender_id: string | null; message: string; created_at: string };

export function FeedbackChat({ semesterId, title = "Feedback chat" }: { semesterId: string; title?: string }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const fetchFn = useServerFn(getThreadForSemester);
  const replyFn = useServerFn(replyFeedback);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, refetch } = useQuery({
    queryKey: ["feedback-thread", semesterId],
    queryFn: () => fetchFn({ data: { semester_id: semesterId } }),
    staleTime: 10000,
  });

  useEffect(() => {
    if (!data?.thread?.id) return;
    const ch = supabase
      .channel(`fb-${data.thread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "schedule_feedback_messages", filter: `thread_id=eq.${data.thread.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["feedback-thread", semesterId] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [data?.thread?.id, qc, semesterId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages?.length]);

  const mut = useMutation({
    mutationFn: () => replyFn({ data: { thread_id: data!.thread!.id, message: text.trim() } }),
    onSuccess: () => { setText(""); refetch(); },
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
    <Card className="rounded-2xl flex flex-col h-[480px]">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> {title}</CardTitle>
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
  );
}