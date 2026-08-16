import { toastError } from "@/lib/errors/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGlobalConfig, updateGlobalConfig } from "@/lib/global-config.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getGlobalConfig);
  const updateFn = useServerFn(updateGlobalConfig);
  const { data } = useQuery({ queryKey: ["global-config"], queryFn: () => getFn() });

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("150");
  const [window, setWindow] = useState("15");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setLat(data.campus_lat == null ? "" : String(data.campus_lat));
    setLng(data.campus_lng == null ? "" : String(data.campus_lng));
    setRadius(String(data.campus_radius_m ?? 150));
    setWindow(String(data.attendance_window_minutes ?? 15));
    setEnabled(data.geofence_enabled ?? true);
  }, [data]);

  const mut = useMutation({
    mutationFn: () => updateFn({ data: {
      id: data?.id,
      campus_lat: lat === "" ? null : Number(lat),
      campus_lng: lng === "" ? null : Number(lng),
      campus_radius_m: Number(radius),
      attendance_window_minutes: Number(window),
      geofence_enabled: enabled,
    }}),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["global-config"] });
    },
    onError: (e: Error) => toastError(e),
  });

  function useMyLocation() {
    if (!navigator.geolocation) { toast.error("Geolocation not available"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(String(p.coords.latitude)); setLng(String(p.coords.longitude)); toast.success("Captured current coordinates"); },
      (e) => toastError(e),
      { enableHighAccuracy: true },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Settings</h1>
        <p className="text-sm text-muted-foreground">Configure the institutional geofence and attendance window.</p>
      </div>
      <Card className="rounded-2xl max-w-2xl">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Campus geofence</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Enforce campus geofence</Label>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "ON — Trainers must be inside the radius to start a session (per-trainer bypass still applies)."
                  : "OFF — Geofence checks are disabled for ALL trainers."}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Campus latitude</Label>
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 9.0312" disabled={!enabled} />
            </div>
            <div>
              <Label>Campus longitude</Label>
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 38.7469" disabled={!enabled} />
            </div>
            <div>
              <Label>Geofence radius (meters)</Label>
              <Input type="number" min={10} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} disabled={!enabled} />
            </div>
            <div>
              <Label>Attendance window (minutes)</Label>
              <Input type="number" min={0} max={120} value={window} onChange={(e) => setWindow(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={useMyLocation} disabled={!enabled}>Use my current location</Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              <Save className="mr-2 h-4 w-4" /> {mut.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Trainers must be inside this radius to start a session. Trainers with the bypass flag enabled in Users & Roles are exempt."
              : "Geofence enforcement is globally disabled — sessions can be started from anywhere, regardless of per-trainer settings."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
