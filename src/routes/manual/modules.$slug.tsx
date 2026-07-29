import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Home, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getModule, moduleNeighbours, MANUAL_MODULES } from "@/lib/manual/modules";
import {
  StatCard, ScreenshotFigure, CalloutBox, TaskAccordion, ModuleProgressBar, ModulePager,
} from "@/components/manual/manual-pieces";

export const Route = createFileRoute("/manual/modules/$slug")({
  loader: ({ params }) => {
    const mod = getModule(params.slug);
    if (!mod) throw notFound();
    return { slug: mod.slug, title: mod.title, description: mod.description };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Guide unavailable — Acme Corp ERP User Manual" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${loaderData.title} Guide — Acme Corp ERP Manual`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.description.slice(0, 155) },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: ModuleNotFound,
  component: ModulePage,
});

function ModuleNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Guide not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        That module isn’t part of the manual.
      </p>
      <Button asChild className="mt-6">
        <Link to="/manual">Back to manual home</Link>
      </Button>
    </div>
  );
}

function ModulePage() {
  const { slug } = Route.useParams();
  const mod = getModule(slug)!;
  const { prev, next } = moduleNeighbours(slug);
  const Icon = mod.icon;
  const related = mod.related
    .map((s) => MANUAL_MODULES.find((m) => m.slug === s))
    .filter(Boolean);

  return (
    <article className="space-y-10">
      <nav aria-label="Breadcrumb" className="manual-no-print flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/manual" className="flex items-center gap-1 hover:text-foreground">
          <Home className="h-3.5 w-3.5" /> Manual
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{mod.title}</span>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <Badge variant="secondary" className="mb-2">{mod.short}</Badge>
              <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
                {mod.title}
              </h1>
            </div>
          </div>
          <ModuleProgressBar slug={mod.slug} />
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground lg:text-base">
          {mod.description}
        </p>
      </header>

      {mod.stats.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">What you’ll see here</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {mod.stats.map((s) => <StatCard key={s.label} stat={s} />)}
          </div>
        </section>
      )}

      {mod.screenshots.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Screen reference</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {mod.screenshots.map((s) => <ScreenshotFigure key={s.src} shot={s} />)}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Step-by-step tasks
        </h2>
        <TaskAccordion moduleSlug={mod.slug} tasks={mod.tasks} />
      </section>

      {mod.callouts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Tips and warnings</h2>
          {mod.callouts.map((c) => <CalloutBox key={c.text} callout={c} />)}
        </section>
      )}

      {related.length > 0 && (
        <section className="manual-no-print space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Related modules</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Button key={r!.slug} asChild variant="outline" size="sm">
                <Link to="/manual/modules/$slug" params={{ slug: r!.slug }}>{r!.title}</Link>
              </Button>
            ))}
          </div>
        </section>
      )}

      <ModulePager prev={prev} next={next} />
    </article>
  );
}