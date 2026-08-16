import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVenues, upsertVenue, deleteVenue } from "@/lib/data.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VENUE_TYPE_OPTIONS } from "@/lib/master-data";
import { useInvalidateMasterData } from "@/hooks/use-master-data";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/strategic/venues")({
  component: VenuesPage,
});

type VType = "Classroom" | "Lab" | "Workshop";
type Venue = { id: string; name: string; type: VType; capacity: number; latitude: number; longitude: number; geo_radius: number };

function VenuesPage() {
  const qc = useQueryClient();
  const { authReady, hasSession } = useAuthSession();
  const list = useServerFn(listVenues);
  const upsert = useServerFn(upsertVenue);
  const del = useServerFn(deleteVenue);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => list(),
    enabled: authReady && hasSession,
    throwOnError: false,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<VType>("Classroom");
  const [capacity, setCapacity] = useState<number>(30);
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [geoRadius, setGeoRadius] = useState<number>(50);

  const saveMut = useMutation({
    mutationFn: () => upsert({ data: { id: editing?.id, name, type, capacity, latitude, longitude, geo_radius: geoRadius } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["venues"] }); invalidateMaster(); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["venues"] }); invalidateMaster(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const useGPS = () => {
    if (!navigator.geolocation) return toast.error("Geolocation unavailable");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); toast.success("Coordinates filled"); },
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const openNew = () => {
    setEditing(null); setName(""); setType("Classroom"); setCapacity(30);
    setLatitude(0); setLongitude(0); setGeoRadius(50);
  };
  const openEdit = (v: Venue) => {
    setEditing(v); setName(v.name); setType(v.type); setCapacity(v.capacity);
    setLatitude(Number(v.latitude)); setLongitude(Number(v.longitude)); setGeoRadius(Number(v.geo_radius));
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Venues</h1>
          <p className="text-sm text-muted-foreground">Physical locations with geo-fence for attendance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New venue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit venue" : "New venue"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as VType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    {VENUE_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacity</Label>
                  <Input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={latitude} onChange={(e) => setLatitude(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={longitude} onChange={(e) => setLongitude(Number(e.target.value))} />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={useGPS}>
                <MapPin className="mr-2 h-4 w-4" /> Use device GPS
              </Button>
              <div className="space-y-2">
                <Label>Geo radius (meters)</Label>
                <Input type="number" value={geoRadius} onChange={(e) => setGeoRadius(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!name || saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Capacity</TableHead>
              <TableHead>Coordinates</TableHead><TableHead>Radius</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!isLoading && rows?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No venues yet.</TableCell></TableRow>}
            {rows?.map((r) => {
              const v = r as Venue;
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell><Badge variant="secondary">{v.type}</Badge></TableCell>
                  <TableCell>{v.capacity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{Number(v.latitude).toFixed(5)}, {Number(v.longitude).toFixed(5)}</TableCell>
                  <TableCell>{v.geo_radius} m</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${v.name}?`)) delMut.mutate(v.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}