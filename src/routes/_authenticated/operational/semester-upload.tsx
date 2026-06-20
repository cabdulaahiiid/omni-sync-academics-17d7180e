import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check, ChevronsUpDown, Send, ShieldCheck, Save, X, CalendarRange, AlertTriangle, CheckCircle2,
  Sparkles, Building2, Users, BookOpen, MapPin, Clock, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMe } from "@/hooks/use-me";
import { useLiveTables } from "@/hooks/use-live-tables";
import { getBuilderOptions, getTrainerLoad, validateBuilder, saveBuilderDraft } from "@/lib/semester-builder.functions";
import { requestSemesterApproval, dhRequestApprovalPerWeek } from "@/lib/semester-drafts.functions";

export const Route = createFileRoute("/_authenticated/operational/semester-upload")({
  component: SemesterBuilderPage,
});

type Day = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
const DAYS: { code: Day; label: string }[] = [
  { code: "MON", label: "Mon" }, { code: "TUE", label: "Tue" }, { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" }, { code: "FRI", label: "Fri" }, { code: "SAT", label: "Sat" }, { code: "SUN", label: "Sun" },
];

function parseSemesterName(name: string): { year: number; term: string } | null {
  const m = name.match(/Year\s+(\d{4})\s*[\u2013-]\s*(.+)/);
  if (!m) return null;
  return { year: Number(m[1]), term: m[2].trim() };
}

function diffWeeks(start: string, end: string) {
  const s = new Date(start), e = new Date(end);
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

function Combobox<T extends { id: string }>({
  value, onChange, placeholder, items, getLabel, getKey, disabled,
}: {
  value: string | null;
  onChange: (id: string) => void;
  placeholder: string;
  items: T[];
  getLabel: (item: T) => string;
  getKey?: (item: T) => string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value) ?? null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}>
          <span className="truncate">{selected ? getLabel(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const k = getKey ? getKey(item) : getLabel(item);
                return (
                  <CommandItem key={item.id} value={k} onSelect={() => { onChange(item.id); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{getLabel(item)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ kind }: { kind: "green" | "yellow" | "red" | "neutral" }) {
  const styles = {
    green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    yellow: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    red: "bg-destructive/10 text-destructive border-destructive/40",
    neutral: "bg-muted text-muted-foreground border-border",
  }[kind];
  return <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium", styles)}>
    {kind === "green" ? "Available" : kind === "yellow" ? "Warning" : kind === "red" ? "Conflict" : "—"}
  </span>;
}

function SectionCard({ step, title, icon: Icon, children }: { step: number; title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Section {step}</div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function SemesterBuilderPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Live invalidation across the ERP whenever schedules / semester / approvals change.
  useLiveTables(
    ["schedules", "semester_registry", "approval_queue", "notifications"],
    ["builder-options", "trainer-load", "semesters", "drafts", "dashboard"],
  );

  const optionsFn = useServerFn(getBuilderOptions);
  const loadFn = useServerFn(getTrainerLoad);
  const validateFn = useServerFn(validateBuilder);
  const saveFn = useServerFn(saveBuilderDraft);
  const submitFullFn = useServerFn(requestSemesterApproval);
  const submitWeeklyFn = useServerFn(dhRequestApprovalPerWeek);

  const { data: opts, isLoading: optsLoading } = useQuery({
    queryKey: ["builder-options", me?.profile?.department_id ?? "none"],
    queryFn: () => optionsFn({ data: me?.profile?.department_id ? { department_id: me.profile.department_id } : {} }),
    enabled: !!me,
    staleTime: 60_000,
  });

  // ---- Form state -----------------------------------------------------------
  const [academicYear, setAcademicYear] = useState<string>("");
  const [semesterId, setSemesterId] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("");
  const [trainerId, setTrainerId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("");
  const [venueId, setVenueId] = useState<string>("");
  const [delivery, setDelivery] = useState<"Theory" | "Practical" | "Both">("Theory");
  const [theoryDays, setTheoryDays] = useState<Day[]>([]);
  const [practicalDays, setPracticalDays] = useState<Day[]>([]);
  const [theorySessionName, setTheorySessionName] = useState("");
  const [practicalSessionName, setPracticalSessionName] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(1);
  const [durationHours, setDurationHours] = useState<number>(2);
  const [durationMinutes, setDurationMinutes] = useState<number>(0);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [publishOpen, setPublishOpen] = useState(false);

  // Derived
  const semesters = opts?.semesters ?? [];
  const yearsBySemester = useMemo(() => {
    const map = new Map<string, typeof semesters>();
    for (const s of semesters) {
      const parsed = parseSemesterName(s.name);
      const key = parsed ? String(parsed.year) : "Other";
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [semesters]);
  const availableYears = useMemo(() => Array.from(yearsBySemester.keys()).sort().reverse(), [yearsBySemester]);
  const semestersForYear = academicYear ? yearsBySemester.get(academicYear) ?? [] : semesters;
  const selectedSem = semesters.find((s) => s.id === semesterId) ?? null;

  const selectedModule = opts?.modules.find((m) => m.id === moduleId) ?? null;
  const selectedTrainer = opts?.trainers.find((t) => t.id === trainerId) ?? null;
  const selectedVenue = opts?.venues.find((v) => v.id === venueId) ?? null;
  const selectedSection = opts?.sections.find((s) => s.id === sectionId) ?? null;
  const selectedLevel = opts?.levels.find((l) => l.id === levelId) ?? null;
  const moduleDeptName = opts?.departments.find((d) => d.id === selectedModule?.department_id)?.name ?? "—";

  // When module changes, sync level to module's level (modules are scoped to a level).
  useEffect(() => {
    if (selectedModule && selectedModule.level_id && selectedModule.level_id !== levelId) {
      setLevelId(selectedModule.level_id);
      setSectionId("");
    }
  }, [selectedModule, levelId]);

  const sectionsForLevel = useMemo(
    () => (opts?.sections ?? []).filter((s) => !levelId || s.level_id === levelId),
    [opts?.sections, levelId],
  );

  // Trainer load
  const { data: trainerLoad } = useQuery({
    queryKey: ["trainer-load", semesterId],
    queryFn: () => loadFn({ data: { semester_id: semesterId } }),
    enabled: !!semesterId,
    staleTime: 30_000,
  });
  const trainerCurrentMins = trainerId ? trainerLoad?.[trainerId]?.weekly_minutes ?? 0 : 0;

  // Computed schedule
  const durationMin = durationHours * 60 + durationMinutes;
  const daysSelected: Day[] = useMemo(() => {
    const t = delivery === "Practical" ? [] : theoryDays;
    const p = delivery === "Theory" ? [] : practicalDays;
    return Array.from(new Set([...t, ...p]));
  }, [delivery, theoryDays, practicalDays]);
  const weeklyMins = daysSelected.length * durationMin;
  const totalWeeks = selectedSem ? diffWeeks(selectedSem.start_date, selectedSem.end_date) : 0;
  const totalContactMins = weeklyMins * totalWeeks;

  // Auto end-time
  const endTime = useMemo(() => {
    if (!startTime || !durationMin) return "";
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + durationMin;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }, [startTime, durationMin]);

  // ---- Validation -----------------------------------------------------------
  const builderPayload = useMemo(() => ({
    semester_id: semesterId,
    department_id: me?.profile?.department_id ?? "",
    module_id: moduleId, trainer_id: trainerId, section_id: sectionId, level_id: levelId, venue_id: venueId,
    delivery,
    theory_days: delivery === "Practical" ? [] : theoryDays,
    theory_session_name: theorySessionName,
    practical_days: delivery === "Theory" ? [] : practicalDays,
    practical_session_name: practicalSessionName,
    start_date: startDate, start_time: startTime,
    duration_hours: durationHours, duration_minutes: durationMinutes,
  }), [semesterId, me?.profile?.department_id, moduleId, trainerId, sectionId, levelId, venueId, delivery, theoryDays, practicalDays, theorySessionName, practicalSessionName, startDate, startTime, durationHours, durationMinutes]);

  const formComplete = !!(builderPayload.semester_id && builderPayload.department_id && builderPayload.module_id &&
    builderPayload.trainer_id && builderPayload.section_id && builderPayload.level_id && builderPayload.venue_id &&
    builderPayload.start_date && builderPayload.start_time && durationMin > 0 && daysSelected.length > 0);

  const validateMut = useMutation({
    mutationFn: () => validateFn({ data: builderPayload }),
    onError: (e: Error) => toast.error(e.message),
  });
  // Auto-validate on form changes (debounced via reactive deps).
  useEffect(() => {
    if (!formComplete) return;
    const id = setTimeout(() => validateMut.mutate(), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(builderPayload), formComplete]);

  const validation = validateMut.data;

  // ---- Save / Publish -------------------------------------------------------
  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: builderPayload }),
    onSuccess: (r) => {
      toast.success(`Saved ${r.created} draft session(s).`);
      qc.invalidateQueries({ queryKey: ["trainer-load"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["drafts"] });
      setPublishOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitFull = useMutation({
    mutationFn: () => submitFullFn({ data: { semester_id: semesterId } }),
    onSuccess: () => { toast.success("Sent to Admin for approval"); setPublishOpen(false); navigate({ to: "/operational/drafts" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitWeekly = useMutation({
    mutationFn: () => submitWeeklyFn({ data: { semester_id: semesterId } }),
    onSuccess: (r) => { toast.success(`Submitted ${r.created} weekly session(s)`); setPublishOpen(false); navigate({ to: "/operational/drafts" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const conflicts = validation?.conflicts ?? [];
  const warnings = validation?.warnings ?? [];
  const validationOk = !!validation?.ok;

  const resetForm = () => {
    setSemesterId(""); setAcademicYear(""); setModuleId(""); setTrainerId(""); setSectionId(""); setLevelId("");
    setVenueId(""); setDelivery("Theory"); setTheoryDays([]); setPracticalDays([]); setTheorySessionName(""); setPracticalSessionName("");
    setSessionsPerWeek(1); setDurationHours(2); setDurationMinutes(0); setStartDate(""); setStartTime("08:00");
  };

  if (optsLoading || !opts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold tracking-tight">Semester Schedule Builder</h1>
            <p className="text-sm text-muted-foreground">Database-driven, conflict-checked in real time. Saved drafts feed Drafts, Approvals, Trainer Hub, Live Monitoring, Reports, and Notifications instantly.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* LEFT: form */}
        <div className="space-y-4">
          <SectionCard step={1} title="Semester Information" icon={CalendarRange}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Academic Year</Label>
                <Select value={academicYear} onValueChange={(v) => { setAcademicYear(v); setSemesterId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Pick year" /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Semester</Label>
                <Select value={semesterId} onValueChange={setSemesterId}>
                  <SelectTrigger><SelectValue placeholder={academicYear ? "Pick semester" : "Pick a year first"} /></SelectTrigger>
                  <SelectContent>
                    {semestersForYear.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedSem && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-3">
                <div><span className="text-muted-foreground">Start:</span> <b>{selectedSem.start_date}</b></div>
                <div><span className="text-muted-foreground">End:</span> <b>{selectedSem.end_date}</b></div>
                <div><span className="text-muted-foreground">Total weeks:</span> <b>{totalWeeks}</b></div>
              </div>
            )}
          </SectionCard>

          <SectionCard step={2} title="Module Information" icon={BookOpen}>
            <Combobox value={moduleId} onChange={setModuleId}
              placeholder="Search module by code or name"
              items={opts.modules}
              getKey={(m) => `${m.code} ${m.name}`}
              getLabel={(m) => `${m.code} — ${m.name}`} />
            {selectedModule && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-4">
                <div><span className="text-muted-foreground">Name:</span> <b>{selectedModule.name}</b></div>
                <div><span className="text-muted-foreground">Credit hours:</span> <b>{selectedModule.total_hours}</b></div>
                <div><span className="text-muted-foreground">Department:</span> <b>{moduleDeptName}</b></div>
                <div><span className="text-muted-foreground">Type:</span> <b>{selectedModule.type}</b></div>
              </div>
            )}
          </SectionCard>

          <SectionCard step={3} title="Trainer Assignment" icon={Users}>
            <Combobox value={trainerId} onChange={setTrainerId}
              placeholder="Search trainer by name or ID"
              items={opts.trainers}
              getKey={(t) => `${t.hidden_staff_id} ${t.full_name}`}
              getLabel={(t) => `${t.full_name} (${t.hidden_staff_id})`} />
            {selectedTrainer && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-4">
                <div><span className="text-muted-foreground">Trainer ID:</span> <b>{selectedTrainer.hidden_staff_id}</b></div>
                <div><span className="text-muted-foreground">Target:</span> <b>{selectedTrainer.sessions_target} sessions</b></div>
                <div><span className="text-muted-foreground">Current weekly:</span> <b>{(trainerCurrentMins / 60).toFixed(1)} h</b></div>
                <div className="flex items-center gap-2"><span className="text-muted-foreground">Status:</span>
                  <StatusBadge kind={trainerCurrentMins > 30 * 60 ? "yellow" : "green"} />
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard step={4} title="Schedule Information" icon={Clock}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sessions per week</Label>
                <Input type="number" min={1} max={7} value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duration — Hours</Label>
                <Input type="number" min={0} max={8} value={durationHours} onChange={(e) => setDurationHours(Math.max(0, Math.min(8, Number(e.target.value) || 0)))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Duration — Minutes</Label>
                <Input type="number" min={0} max={59} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} />
              </div>
            </div>
            <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-3">
              <div><span className="text-muted-foreground">Per session:</span> <b>{(durationMin / 60).toFixed(2)} h</b></div>
              <div><span className="text-muted-foreground">Weekly:</span> <b>{(weeklyMins / 60).toFixed(2)} h</b></div>
              <div><span className="text-muted-foreground">Semester total:</span> <b>{(totalContactMins / 60).toFixed(1)} h</b></div>
            </div>
          </SectionCard>

          <SectionCard step={5} title="Class Assignment" icon={Building2}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Level</Label>
                <Combobox value={levelId} onChange={(id) => { setLevelId(id); setSectionId(""); }}
                  placeholder="Pick level" items={opts.levels} getLabel={(l) => l.name} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Section</Label>
                <Combobox value={sectionId} onChange={setSectionId}
                  placeholder={levelId ? "Pick section" : "Pick level first"}
                  items={sectionsForLevel} getLabel={(s) => s.name} disabled={!levelId} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Venue</Label>
                <Combobox value={venueId} onChange={setVenueId}
                  placeholder="Pick venue" items={opts.venues}
                  getKey={(v) => `${v.name} ${v.type}`}
                  getLabel={(v) => `${v.name} (${v.type})`} />
              </div>
            </div>
            {selectedVenue && (
              <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-3">
                <div><span className="text-muted-foreground">Capacity:</span> <b>{selectedVenue.capacity}</b></div>
                <div><span className="text-muted-foreground">Type:</span> <b>{selectedVenue.type}</b></div>
                <div className="flex items-center gap-2"><span className="text-muted-foreground">Availability:</span>
                  <StatusBadge kind={conflicts.some((c) => c.kind === "venue") ? "red" : "green"} />
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard step={6} title="Delivery Type" icon={MapPin}>
            <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as any)} className="flex flex-wrap gap-4">
              {(["Theory", "Practical", "Both"] as const).map((opt) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <RadioGroupItem value={opt} /> {opt}
                </label>
              ))}
            </RadioGroup>

            {(delivery === "Theory" || delivery === "Both") && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theory</div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = theoryDays.includes(d.code);
                    return (
                      <button key={d.code} type="button"
                        onClick={() => setTheoryDays((prev) => on ? prev.filter((x) => x !== d.code) : [...prev, d.code])}
                        className={cn("h-8 rounded-lg border px-3 text-xs", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <Input placeholder="Theory session name (e.g. Lecture)" value={theorySessionName} onChange={(e) => setTheorySessionName(e.target.value)} />
              </div>
            )}
            {(delivery === "Practical" || delivery === "Both") && (
              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Practical</div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = practicalDays.includes(d.code);
                    return (
                      <button key={d.code} type="button"
                        onClick={() => setPracticalDays((prev) => on ? prev.filter((x) => x !== d.code) : [...prev, d.code])}
                        className={cn("h-8 rounded-lg border px-3 text-xs", on ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <Input placeholder="Practical session name (e.g. Workshop)" value={practicalSessionName} onChange={(e) => setPracticalSessionName(e.target.value)} />
              </div>
            )}
          </SectionCard>

          <SectionCard step={7} title="Schedule Timing" icon={Clock}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={startDate}
                  min={selectedSem?.start_date} max={selectedSem?.end_date}
                  onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-xs md:grid-cols-3">
              <div><span className="text-muted-foreground">End time / session:</span> <b>{endTime || "—"}</b></div>
              <div><span className="text-muted-foreground">Last session date:</span> <b>{validation?.summary.end_date ?? "—"}</b></div>
              <div><span className="text-muted-foreground">Semester completion:</span> <b>{selectedSem?.end_date ?? "—"}</b></div>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT: live preview + validation */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="rounded-2xl border-primary/20 bg-card/95 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-primary" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <PreviewRow k="Module" v={selectedModule ? `${selectedModule.code} — ${selectedModule.name}` : "—"} />
              <PreviewRow k="Trainer" v={selectedTrainer ? selectedTrainer.full_name : "—"} />
              <PreviewRow k="Section" v={selectedSection?.name ?? "—"} />
              <PreviewRow k="Level" v={selectedLevel?.name ?? "—"} />
              <PreviewRow k="Venue" v={selectedVenue ? `${selectedVenue.name} (${selectedVenue.type})` : "—"} />
              <PreviewRow k="Class type" v={delivery} />
              <PreviewRow k="Session days" v={daysSelected.length ? daysSelected.join(", ") : "—"} />
              <PreviewRow k="Frequency" v={`${daysSelected.length}/week`} />
              <PreviewRow k="Duration" v={durationMin ? `${(durationMin / 60).toFixed(2)} h` : "—"} />
              <PreviewRow k="Start" v={startDate ? `${startDate} ${startTime}` : "—"} />
              <PreviewRow k="End date" v={validation?.summary.end_date ?? "—"} />
              <PreviewRow k="Weekly contact hours" v={`${(weeklyMins / 60).toFixed(2)} h`} />
              <PreviewRow k="Total semester hours" v={`${(totalContactMins / 60).toFixed(1)} h`} />
              <PreviewRow k="Occurrences" v={validation?.summary.occurrences != null ? String(validation.summary.occurrences) : "—"} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" /> Validation</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {!formComplete && <p className="text-muted-foreground">Fill every section to run validation.</p>}
              {formComplete && validateMut.isPending && <p className="text-muted-foreground">Checking conflicts…</p>}
              {formComplete && !validateMut.isPending && validation && (
                <>
                  <div className="flex items-center gap-2">
                    {validationOk
                      ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> <span>No conflicts detected.</span></>
                      : <><AlertTriangle className="h-4 w-4 text-destructive" /> <span>{conflicts.length} conflict(s) block save.</span></>}
                  </div>
                  {conflicts.slice(0, 6).map((c, i) => (
                    <div key={i} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                      <b className="capitalize">{c.kind}</b>: {c.reason}
                    </div>
                  ))}
                  {warnings.slice(0, 6).map((w, i) => (
                    <div key={`w${i}`} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-700 dark:text-amber-400">
                      ⚠ {w.reason}
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur lg:pl-72">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2">
          <div className="mr-auto text-xs text-muted-foreground">
            {formComplete
              ? validationOk ? <span className="text-emerald-600">Ready to save.</span>
                : <span className="text-destructive">Resolve conflicts before saving.</span>
              : <span>Complete all sections to enable actions.</span>}
          </div>
          <Button variant="ghost" onClick={resetForm}><X className="mr-2 h-4 w-4" /> Cancel</Button>
          <Button variant="outline" onClick={() => validateMut.mutate()} disabled={!formComplete || validateMut.isPending}>
            <ShieldCheck className="mr-2 h-4 w-4" /> {validateMut.isPending ? "Validating…" : "Validate Schedule"}
          </Button>
          <Button variant="secondary" onClick={() => saveMut.mutate()} disabled={!formComplete || !validationOk || saveMut.isPending}>
            <Save className="mr-2 h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save as Draft"}
          </Button>
          <Button onClick={async () => { if (!saveMut.data) await saveMut.mutateAsync(); else setPublishOpen(true); }}
            disabled={!formComplete || !validationOk || saveMut.isPending}>
            <Send className="mr-2 h-4 w-4" /> Submit & Publish
          </Button>
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>How would you like Admin to review this semester?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Drafts have been saved. Choose a submission path:</p>
            <ul className="list-disc pl-5">
              <li><b>By Week</b> — Admin approves/rejects each week independently.</li>
              <li><b>Full Semester</b> — Admin reviews the entire semester at once.</li>
            </ul>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Not now</Button>
            <Button variant="secondary" onClick={() => submitWeekly.mutate()} disabled={submitWeekly.isPending}>
              {submitWeekly.isPending ? "Submitting…" : "Request Approval by Week"}
            </Button>
            <Button onClick={() => submitFull.mutate()} disabled={submitFull.isPending}>
              {submitFull.isPending ? "Submitting…" : "Request Approval for Full Semester"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-1 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}