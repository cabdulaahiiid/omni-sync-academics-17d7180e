import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MANUAL_MODULES } from "@/lib/manual/modules";
import { useManual } from "@/lib/manual/manual-context";

export const Route = createFileRoute("/manual/")({
  head: () => ({
    meta: [
      { title: "Acme Corp ERP User Manual — Guides for Every Module" },
      {
        name: "description",
        content:
          "Step-by-step guides for the Acme Corp ERP: dashboard, inventory, sales, purchasing, reporting and administration.",
      },
      { property: "og:title", content: "Acme Corp ERP User Manual" },
      {
        property: "og:description",
        content: "Task-based instructions for every Acme Corp ERP module, with progress tracking and print-ready pages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManualHome,
});

function ManualHome() {
  const { moduleProgress } = useManual();
  const totals = MANUAL_MODULES.reduce(
    (acc, m) => {
      const p = moduleProgress(m.slug);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <div className="space-y-10">
      <header className="rounded-2xl border border-border bg-primary px-6 py-10 text-primary-foreground lg:px-10 lg:py-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">
          <BookOpen className="h-3.5 w-3.5" /> Version 1.0
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight lg:text-4xl">
          Acme Corp ERP User Manual
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/85 lg:text-base">
          Everything your team needs to run the ERP day to day — organised by module, written as
          numbered tasks you can follow at your desk or print for the floor.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="secondary" size="lg">
            <Link to="/manual/modules/$slug" params={{ slug: MANUAL_MODULES[0].slug }}>
              Start with {MANUAL_MODULES[0].title} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="manual-no-print border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" /> Print manual
          </Button>
        </div>
      </header>

      <section className="manual-no-print rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">Your overall progress</span>
          <span className="tabular-nums text-muted-foreground">
            {totals.done} of {totals.total} tasks complete
          </span>
        </div>
        <Progress value={pct} className="h-2.5" />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">Modules</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MANUAL_MODULES.map((m) => {
            const p = moduleProgress(m.slug);
            const Icon = m.icon;
            return (
              <Card key={m.slug} className="group flex flex-col border-border bg-card transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle className="text-base">{m.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                  <p className="line-clamp-3 text-sm text-muted-foreground">{m.description}</p>
                  <div className="mt-auto space-y-3">
                    <div className="manual-no-print">
                      <Progress value={p.pct} className="h-1.5" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.done}/{p.total} tasks
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/manual/modules/$slug" params={{ slug: m.slug }}>
                        Open guide <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}