import { toastError } from "@/lib/errors/toast";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import React from "react";
import { listSemesterDrafts, requestSemesterApproval, dhRequestApprovalPerWeek, listDraftModules, listPlanSessions } from "@/lib/semester-drafts.functions";
import { listWeekThreadsForDept, dhResubmitWeek } from "@/lib/feedback.functions";
import { WeekFeedbackWorkspace } from "@/components/week-feedback-workspace";
import { useMe } from "@/hooks/use-me";
import { useDhScheduleLive } from "@/hooks/use-dh-schedule-live";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, FileClock, MessageSquareWarning, CalendarRange, Clock, CheckCircle2, Upload as UploadIcon, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/operational/drafts")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({
      semester: z.string().uuid().optional(),
      week: z.coerce.number().int().optional(),
      chat: z.coerce.number().int().optional(),
    }).parse(s),
  component: DraftsPage,
});

type WeekBucket = "DRAFT" | "PENDING" | "FEEDBACK" | "APPROVED";

const PILL: Record<WeekBucket, string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
  PENDING:  "bg-amber-500/15 text-amber-700 border-amber-500/40",
  FEEDBACK: "border-2 border-destructive text-destructive bg-transparent",
  DRAFT:    "bg-muted text-muted-foreground border-border",
};

const DOT: Record<WeekBucket, string> = {
  APPROVED: "bg-emerald-500",
  PENDING:  "bg-amber-500",
  FEEDBACK: "bg-destructive",
  DRAFT:    "bg-muted-foreground/40",
};

function StatusPill({ bucket, children }: { bucket: WeekBucket; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", PILL[bucket])}>
      {children}
    </span>
  );
}

type WeekRow = {
  semester_id: string;
  semester_name: string;
  start_date: string;
  end_date: string;
  week_num: number;
  total: number;
  pending: number;
  published: number;
  bucket: WeekBucket;
};

type SemesterRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  distribution_status: string | null;
  weeks: { week_num: number; total: number; draft?: number; pending: number; published: number }[];
};

function DraftsPage() {
  const { data: me } = useMe();
  const search = useSearch({ from: "/_authenticated/operational/drafts" });
  const listFn = useServerFn(listSemesterDrafts);
  const listModulesFn = useServerFn(listDraftModules);
  const reqFn = useServerFn(requestSemesterApproval);
  const reqWeekFn = useServerFn(dhRequestApprovalPerWeek);
  const weekThreadsFn = useServerFn(listWeekThreadsForDept);
  const resubmitWeekFn = useServerFn(dhResubmitWeek);
  const qc = useQueryClient();
  const [openWorkspace, setOpenWorkspace] = useState<{ semester_id: string; week_num: number; title: string } | null>(null);
  const isAdmin = me?.roles?.includes("MA") ?? false;

  useEffect(() => {
    if (search.chat && search.semester && search.week != null) {
      setOpenWorkspace({
        semester_id: search.semester,
        week_num: search.week,
        title: `Week ${search.week}`,
      });
    }
  }, [search.chat, search.semester, search.week]);

  const deptId = me?.profile?.department_id;
  // Single shared DH channel: covers schedules, plans, terms, approvals and
  // feedback, and invalidates every DH query root (including draft-modules).
  useDhScheduleLive(deptId ?? null, [`week-feedback-threads`]);
  const { data, isLoading } = useQuery({
    queryKey: ["semester-drafts", deptId],
    queryFn: () => listFn({ data: deptId ? { department_id: deptId } : {} }),
    enabled: !!me && (!!deptId || isAdmin),
  });
  const { data: weekThreads } = useQuery({
    queryKey: ["week-feedback-threads", deptId],
    queryFn: () => weekThreadsFn({ data: { department_id: deptId! } }),
    enabled: !!deptId,
  });

  // DH only: the Full Module representation of the very same draft rows.
  const isDH = (me?.roles?.includes("DH") ?? false) && !isAdmin;
  const [draftView, setDraftView] = useState<"weekly" | "module">("weekly");
  const { data: moduleGroups } = useQuery({
    queryKey: ["draft-modules", deptId],
    queryFn: () => listModulesFn({ data: deptId ? { department_id: deptId } : {} }),
    enabled: isDH && !!deptId,
  });

  const submitMut = useMutation({
    mutationFn: (semester_id: string) => reqFn({ data: { semester_id } }),
    onSuccess: () => {
      toast.success("Level sent to Admin for approval");
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const submitPerWeekMut = useMutation({
    mutationFn: (semester_id: string) => reqWeekFn({ data: { semester_id } }),
    onSuccess: (r) => {
      if ((r?.created ?? 0) === 0) {
        toast.warning("Nothing new to submit — all sessions are already pending or live.");
      } else {
        toast.success(`Submitted ${r.created} weekly session(s) to Admin`);
      }
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const resubmitWeekMut = useMutation({
    mutationFn: (v: { semester_id: string; week_num: number }) =>
      resubmitWeekFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Resubmitted ${r?.count ?? 0} session(s) for approval`);
      qc.invalidateQueries({ queryKey: ["semester-drafts"] });
      qc.invalidateQueries({ queryKey: ["week-feedback-threads", deptId] });
    },
    onError: (e: Error) => toastError(e),
  });

  // Derive per-week buckets. Realtime listener above already refetches when
  // an admin approves a week — no extra wiring needed here for state transitions.
  const feedbackKeys = useMemo(() => {
    const s = new Set<string>();
    for (const t of weekThreads ?? []) s.add(`${t.semester_id}:${t.week_num}`);
    return s;
  }, [weekThreads]);

  const { drafts, pending, approved, allWeeksBySem } = useMemo(() => {
    const semesters = (data ?? []) as SemesterRow[];
    const draftsBySem: Record<string, WeekRow[]> = {};
    const pendingRows: WeekRow[] = [];
    const approvedBySem: Record<string, WeekRow[]> = {};
    const allBySem: Record<string, WeekRow[]> = {};
    const semMeta: Record<string, SemesterRow> = {};

    for (const s of semesters) {
      semMeta[s.id] = s;
      for (const w of s.weeks) {
        const isFeedback = feedbackKeys.has(`${s.id}:${w.week_num}`);
        const baseRow = {
          semester_id: s.id, semester_name: s.name,
          start_date: s.start_date, end_date: s.end_date,
          week_num: w.week_num, total: w.total, pending: w.pending, published: w.published,
        };

        let primaryBucket: WeekBucket = "DRAFT";
        if (isFeedback && (w.draft ?? 0) > 0) primaryBucket = "FEEDBACK";
        else if ((w.draft ?? 0) > 0) primaryBucket = "DRAFT";
        else if (w.pending > 0) primaryBucket = "PENDING";
        else if (w.published > 0) primaryBucket = "APPROVED";
        (allBySem[s.id] ??= []).push({ ...baseRow, bucket: primaryBucket });

        if ((w.draft ?? 0) > 0 && !isFeedback) {
          (draftsBySem[s.id] ??= []).push({ ...baseRow, total: w.draft ?? 0, bucket: "DRAFT" });
        }
        if (w.pending > 0) {
          pendingRows.push({ ...baseRow, total: w.pending, bucket: "PENDING" });
        }
        if (w.published > 0) {
          (approvedBySem[s.id] ??= []).push({ ...baseRow, total: w.published, bucket: "APPROVED" });
        }
      }
    }

    return {
      drafts: Object.entries(draftsBySem)
        .map(([id, weeks]) => ({ sem: semMeta[id], weeks: weeks.sort((a, b) => a.week_num - b.week_num) }))
        .sort((a, b) => (b.sem?.start_date ?? "").localeCompare(a.sem?.start_date ?? "")),
      pending: pendingRows.sort((a, b) => a.semester_name.localeCompare(b.semester_name) || a.week_num - b.week_num),
      approved: Object.entries(approvedBySem)
        .map(([id, weeks]) => ({ sem: semMeta[id], weeks: weeks.sort((a, b) => a.week_num - b.week_num) }))
        .sort((a, b) => (b.sem?.start_date ?? "").localeCompare(a.sem?.start_date ?? "")),
      allWeeksBySem: allBySem,
    };
  }, [data, feedbackKeys]);

  const openWeek = (semester_id: string, week_num: number, semester_name: string) =>
    setOpenWorkspace({ semester_id, week_num, title: `${semester_name} · Week ${week_num}` });

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading schedule manager…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Schedule Manager</h1>
          <p className="text-[11px] text-muted-foreground">Single-pane lifecycle — Drafts → Pending → Feedback → Approved</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <StatusPill bucket="DRAFT">Draft</StatusPill>
          <StatusPill bucket="PENDING">Pending</StatusPill>
          <StatusPill bucket="FEEDBACK">Revision</StatusPill>
          <StatusPill bucket="APPROVED">Approved</StatusPill>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DraftsQuadrant
          drafts={drafts}
          allWeeksBySem={allWeeksBySem}
          weekThreads={weekThreads ?? []}
          showViewSwitch={isDH}
          view={draftView}
          onViewChange={setDraftView}
          moduleGroups={(moduleGroups ?? []) as any[]}
          onOpenWeek={openWeek}
          onSubmitWeek={(id) => submitPerWeekMut.mutate(id)}
          onSubmitSemester={(id) => submitMut.mutate(id)}
          submittingWeek={submitPerWeekMut.isPending}
          submittingSem={submitMut.isPending}
        />
        <PendingQuadrant rows={pending} onOpenWeek={openWeek} />
        <FeedbackQuadrant
          threads={weekThreads ?? []}
          onOpenWeek={openWeek}
          onResubmit={(semester_id, week_num) => resubmitWeekMut.mutate({ semester_id, week_num })}
          resubmitting={resubmitWeekMut.isPending}
        />
        <ApprovedQuadrant approved={approved} allWeeksBySem={allWeeksBySem} onOpenWeek={openWeek} />
      </div>

      {openWorkspace && (
        <WorkspaceErrorBoundary onClose={() => setOpenWorkspace(null)}>
          <WeekFeedbackWorkspace
            open
            onOpenChange={(o) => !o && setOpenWorkspace(null)}
            semesterId={openWorkspace.semester_id}
            weekNum={openWorkspace.week_num}
            title={openWorkspace.title}
          />
        </WorkspaceErrorBoundary>
      )}
    </div>
  );
}

function QuadrantShell({
  title, icon, count, accent, children,
}: {
  title: string; icon: React.ReactNode; count: number; accent: string; children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex h-[calc(50vh-3rem)] min-h-[320px] flex-col rounded-2xl", accent)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b py-2.5">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
        </CardTitle>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-3">{children}</CardContent>
    </Card>
  );
}

function WeekChip({ row, onClick }: { row: WeekRow; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-lg border p-2 text-left transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs font-semibold">W{row.week_num}</p>
        <StatusPill bucket={row.bucket}>{row.bucket}</StatusPill>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{row.total} sessions</p>
    </button>
  );
}

function DraftsQuadrant({
  drafts, allWeeksBySem, weekThreads, onOpenWeek, onSubmitWeek, onSubmitSemester, submittingWeek, submittingSem,
  showViewSwitch, view, onViewChange, moduleGroups,
}: {
  drafts: { sem: SemesterRow; weeks: WeekRow[] }[];
  allWeeksBySem: Record<string, WeekRow[]>;
  weekThreads: any[];
  onOpenWeek: (sid: string, w: number, name: string) => void;
  onSubmitWeek: (id: string) => void;
  onSubmitSemester: (id: string) => void;
  submittingWeek: boolean;
  submittingSem: boolean;
  showViewSwitch?: boolean;
  view?: "weekly" | "module";
  onViewChange?: (v: "weekly" | "module") => void;
  moduleGroups?: any[];
}) {
  const moduleDrafts = (moduleGroups ?? []).filter((g) => (g.draft ?? 0) > 0);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <QuadrantShell
      title="Active Drafts"
      icon={<FileClock className="h-4 w-4 text-primary" />}
      count={showViewSwitch && view === "module" ? moduleDrafts.length : drafts.reduce((n, d) => n + d.weeks.length, 0)}
      accent="border-primary/40 bg-primary/5"
    >
      {showViewSwitch && (
        <div className="mb-2 inline-flex rounded-lg border bg-background p-0.5 text-[11px]">
          <button type="button" onClick={() => onViewChange?.("weekly")}
            className={cn("rounded-md px-2.5 py-1", view === "weekly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            Weekly (W1…Wn)
          </button>
          <button type="button" onClick={() => onViewChange?.("module")}
            className={cn("rounded-md px-2.5 py-1", view === "module" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            Full Module
          </button>
        </div>
      )}

      {showViewSwitch && view === "module" ? (
        moduleDrafts.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No module drafts.</div>
        ) : (
          <div className="space-y-2">
            {moduleDrafts.map((g) => {
              const canSubmit = (g.distribution_status ?? "DRAFT") === "DRAFT" || g.distribution_status === "FEEDBACK_ACTIVE";
              return (
                <div key={g.key} className="rounded-xl border bg-background p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{g.module_name} — {g.level_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.module_code} · Section {g.section_name} · {g.trainer_name}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {g.start_date} → {g.end_date} · {g.weeks.length} week(s) · {g.sessions} sessions · {(g.total_minutes / 60).toFixed(1)} h
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusPill bucket="DRAFT">{g.draft} draft</StatusPill>
                      {g.plan_id && (
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                          onClick={() => setExpanded(expanded === g.plan_id ? null : g.plan_id)}>
                          {expanded === g.plan_id ? "Hide sessions" : "All sessions"}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" className="h-7 text-[11px]"
                        disabled={!canSubmit || submittingSem}
                        onClick={() => onSubmitSemester(g.semester_id)}>
                        <Send className="mr-1 h-3 w-3" /> Submit module
                      </Button>
                    </div>
                  </div>
                  {g.plan_id && expanded === g.plan_id && <PlanSessionList planId={g.plan_id} />}
                </div>
              );
            })}
          </div>
        )
      ) : drafts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <UploadIcon className="h-6 w-6 opacity-40" />
          <p>No drafts.</p>
          <Link to="/operational/semester-upload" className="text-primary underline">Build a level schedule</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map(({ sem, weeks }) => {
            const ds = sem.distribution_status ?? "DRAFT";
            const canSubmit = ds === "DRAFT" || ds === "FEEDBACK_ACTIVE";
            return (
              <div key={sem.id} className="rounded-xl border bg-background p-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{sem.name}</p>
                    <p className="text-[10px] text-muted-foreground">{sem.start_date} → {sem.end_date}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" className="h-7 text-[11px]"
                            disabled={!canSubmit || submittingWeek}
                            onClick={() => onSubmitWeek(sem.id)}>
                            <CalendarRange className="mr-1 h-3 w-3" /> Submit by Week
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sends each week as an individual approval.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button size="sm" variant="secondary" className="h-7 text-[11px]"
                      disabled={!canSubmit || submittingSem}
                      onClick={() => onSubmitSemester(sem.id)}>
                      <Send className="mr-1 h-3 w-3" /> Submit by Level
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {weeks.map((w) => (
                    <WeekChip key={w.week_num} row={w} onClick={() => onOpenWeek(sem.id, w.week_num, sem.name)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </QuadrantShell>
  );
}

function PendingQuadrant({
  rows, onOpenWeek,
}: { rows: WeekRow[]; onOpenWeek: (sid: string, w: number, name: string) => void }) {
  return (
    <QuadrantShell
      title="Pending Admin Approval"
      icon={<Clock className="h-4 w-4 text-amber-600" />}
      count={rows.length}
      accent="border-amber-500/40 bg-amber-500/5"
    >
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Nothing waiting on Admin.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={`${r.semester_id}:${r.week_num}`}>
              <button type="button"
                onClick={() => onOpenWeek(r.semester_id, r.week_num, r.semester_name)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background p-2 text-left transition-colors hover:bg-accent/40">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{r.semester_name} · Week {r.week_num}</p>
                  <p className="text-[10px] text-muted-foreground">{r.pending} pending · {r.total} total</p>
                </div>
                <StatusPill bucket="PENDING">Pending</StatusPill>
              </button>
            </li>
          ))}
        </ul>
      )}
    </QuadrantShell>
  );
}

function FeedbackQuadrant({
  threads, onOpenWeek, onResubmit, resubmitting,
}: {
  threads: any[];
  onOpenWeek: (sid: string, w: number, name: string) => void;
  onResubmit: (sid: string, w: number) => void;
  resubmitting: boolean;
}) {
  return (
    <QuadrantShell
      title="Feedback Hub"
      icon={<MessageSquareWarning className="h-4 w-4 text-destructive" />}
      count={threads.length}
      accent="border-2 border-destructive/60"
    >
      {threads.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No revisions requested.
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t: any) => (
            <li key={t.id} className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{t.semester_name} · Week {t.week_num}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]"
                    onClick={() => onOpenWeek(t.semester_id, t.week_num, t.semester_name)}>
                    Open chat
                  </Button>
                  <Button size="sm" className="h-7 text-[11px]" disabled={resubmitting}
                    onClick={() => onResubmit(t.semester_id, t.week_num)}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Resubmit
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </QuadrantShell>
  );
}

function ApprovedQuadrant({
  approved, allWeeksBySem, onOpenWeek,
}: {
  approved: { sem: SemesterRow; weeks: WeekRow[] }[];
  allWeeksBySem: Record<string, WeekRow[]>;
  onOpenWeek: (sid: string, w: number, name: string) => void;
}) {
  return (
    <QuadrantShell
      title="Approved & Current"
      icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
      count={approved.reduce((n, a) => n + a.weeks.length, 0)}
      accent="border-emerald-500/40 bg-emerald-500/5"
    >
      {approved.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          No approved weeks yet.
        </div>
      ) : (
        <div className="space-y-3">
          {approved.map(({ sem, weeks }) => {
            const allWeeks = (allWeeksBySem[sem.id] ?? []).sort((a, b) => a.week_num - b.week_num);
            return (
              <div key={sem.id} className="rounded-xl border bg-background p-2.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{sem.name}</p>
                    <p className="text-[10px] text-muted-foreground">{sem.start_date} → {sem.end_date}</p>
                  </div>
                </div>
                {/* Timeline strip */}
                <div className="mb-2 flex items-center gap-1 overflow-x-auto pb-1">
                  {allWeeks.map((w) => (
                    <TooltipProvider key={w.week_num}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button"
                            onClick={() => onOpenWeek(sem.id, w.week_num, sem.name)}
                            className="flex flex-col items-center gap-0.5">
                            <span className={cn("h-2.5 w-2.5 rounded-full", DOT[w.bucket])} />
                            <span className="text-[9px] text-muted-foreground">{w.week_num}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>W{w.week_num} · {w.bucket}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {weeks.map((w) => (
                    <WeekChip key={w.week_num} row={w} onClick={() => onOpenWeek(sem.id, w.week_num, sem.name)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </QuadrantShell>
  );
}

class WorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[WeekFeedbackWorkspace] render error:", error, info);
    toast.error(`Workspace error: ${error.message}`);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6">
          <Card className="max-w-md">
            <CardHeader><CardTitle className="text-sm">Couldn't open this week's workspace</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{this.state.error.message}</p>
              <Button size="sm" variant="secondary" onClick={() => { this.setState({ error: null }); this.props.onClose(); }}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}