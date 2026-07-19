import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-me";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Mail, Phone, Building2, WifiOff, Wifi, Info } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/ground/profile")({
  component: TrainerProfile,
});

function TrainerProfile() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const initials = (me?.profile?.full_name || me?.profile?.email || "TR").slice(0, 2).toUpperCase();
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-slate-200">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Avatar className="h-24 w-24 ring-2 ring-[#123E7C]/20">
            {me?.avatar_url && <AvatarImage src={me.avatar_url} alt="" />}
            <AvatarFallback className="bg-[#123E7C]/10 text-2xl font-semibold text-[#123E7C]">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-slate-900">{me?.profile?.full_name ?? "—"}</p>
            <p className="text-xs uppercase tracking-wider text-[#16A34A]">Trainer</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardContent className="divide-y divide-slate-100 p-0">
          <Row icon={<Mail className="h-4 w-4" />} label="Email" value={me?.profile?.email ?? "—"} />
          <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={(me?.profile as any)?.phone ?? "—"} />
          <Row icon={<Building2 className="h-4 w-4" />} label="Department" value={(me?.profile as any)?.department_name ?? "—"} />
          <Row
            icon={online ? <Wifi className="h-4 w-4 text-[#16A34A]" /> : <WifiOff className="h-4 w-4 text-[#F59E0B]" />}
            label="Sync status"
            value={online ? "Online · Synced" : "Offline · Will sync automatically"}
          />
          <Row icon={<Info className="h-4 w-4" />} label="App version" value="1.0.0" />
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="h-12 w-full rounded-2xl text-base"
        onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}