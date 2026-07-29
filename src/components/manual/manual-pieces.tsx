import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Info, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { Callout, ManualModule, Screenshot, Stat, Task } from "@/lib/manual/types";
import { useManual } from "@/lib/manual/manual-context";

export function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stat.label}
          </p>
          <p className="text-xl font-semibold tabular-nums text-foreground">{stat.value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScreenshotFigure({ shot }: { shot: Screenshot }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex aspect-[16/9] w-full items-center justify-center bg-[repeating-linear-gradient(45deg,var(--muted)_0,var(--muted)_10px,transparent_10px,transparent_20px)]">
        <img
          src={shot.src}
          alt={shot.alt}
          loading="lazy"
          className="max-h-full max-w-full object-contain text-xs text-muted-foreground"
        />
      </div>
      <figcaption className="border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        {shot.caption}
      </figcaption>
    </figure>
  );
}

export function CalloutBox({ callout }: { callout: Callout }) {
  const isTip = callout.kind === "tip";
  const Icon = isTip ? Info : AlertTriangle;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border-l-4 p-4 text-sm",
        isTip
          ? "border-l-accent bg-accent/10 text-foreground"
          : "border-l-destructive bg-destructive/10 text-foreground",
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", isTip ? "text-accent-foreground" : "text-destructive")} />
      <p>
        <span className="font-semibold">{isTip ? "Tip: " : "Important: "}</span>
        {callout.text}
      </p>
    </div>
  );
}

export function TaskAccordion({ moduleSlug, tasks }: { moduleSlug: string; tasks: Task[] }) {
  const { isComplete, toggleTask } = useManual();
  return (
    <Accordion type="multiple" className="space-y-3">
      {tasks.map((task, index) => {
        const done = isComplete(moduleSlug, task.id);
        return (
          <AccordionItem
            key={task.id}
            value={task.id}
            className="manual-print-open rounded-xl border border-border bg-card px-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Checkbox
                checked={done}
                onCheckedChange={() => toggleTask(moduleSlug, task.id)}
                aria-label={`Mark "${task.title}" complete`}
                className="manual-no-print"
              />
              <AccordionTrigger className="flex-1 py-4 text-left hover:no-underline">
                <span className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-semibold text-secondary">
                    {index + 1}
                  </span>
                  <span className={cn("text-sm font-semibold", done && "text-muted-foreground line-through")}>
                    {task.title}
                  </span>
                </span>
              </AccordionTrigger>
            </div>
            <AccordionContent className="pb-5 pl-9">
              <p className="mb-4 text-sm text-muted-foreground">{task.goal}</p>
              <ol className="space-y-4 border-l border-border pl-5">
                {task.steps.map((step, i) => (
                  <li key={step.title} className="relative">
                    <span className="absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                    {step.note ? (
                      <p className="mt-1 rounded-md bg-accent/10 px-2 py-1 text-xs text-foreground">
                        Note: {step.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function ModuleProgressBar({ slug }: { slug: string }) {
  const { moduleProgress } = useManual();
  const { done, total, pct } = moduleProgress(slug);
  return (
    <div className="manual-no-print w-full max-w-xs">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>Reading progress</span>
        <span className="tabular-nums">{done}/{total} tasks</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export function ModulePager({
  prev, next,
}: { prev?: ManualModule; next?: ManualModule }) {
  return (
    <nav className="manual-no-print flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
      {prev ? (
        <Link
          to="/manual/modules/$slug"
          params={{ slug: prev.slug }}
          className="group flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-secondary"
        >
          <ArrowLeft className="h-4 w-4 text-secondary" />
          <span>
            <span className="block text-xs text-muted-foreground">Previous</span>
            <span className="font-medium">{prev.title}</span>
          </span>
        </Link>
      ) : <span />}
      {next ? (
        <Link
          to="/manual/modules/$slug"
          params={{ slug: next.slug }}
          className="group ml-auto flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-right text-sm transition-colors hover:border-secondary"
        >
          <span>
            <span className="block text-xs text-muted-foreground">Next</span>
            <span className="font-medium">{next.title}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-secondary" />
        </Link>
      ) : null}
    </nav>
  );
}