import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { listMyNotifications, markAllNotificationsRead } from "@/lib/notifications.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function NotificationsBell() {
  const qc = useQueryClient();
  const { authReady, hasSession, userId } = useAuthSession();
  const list = useServerFn(listMyNotifications);
  const markAll = useServerFn(markAllNotificationsRead);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => list(),
    enabled: authReady && hasSession && !!userId,
    staleTime: 15000,
    throwOnError: false,
  });

  useEffect(() => {
    if (!authReady || !hasSession || !userId) return;
    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [authReady, hasSession, userId, qc]);

  const markAllMut = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={() => markAllMut.mutate()} className="text-xs text-muted-foreground hover:text-foreground">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">No notifications</p>
          )}
          {items.map((n) => (
            <div key={n.id} className={`border-b p-3 text-xs last:border-0 ${n.read ? "" : "bg-accent/30"}`}>
              <p className="font-medium">{n.title}</p>
              <p className="mt-0.5 text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}