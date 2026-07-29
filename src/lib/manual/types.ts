import type { LucideIcon } from "lucide-react";

export type Step = {
  title: string;
  detail: string;
  note?: string;
};

export type Task = {
  id: string;
  title: string;
  goal: string;
  steps: Step[];
};

export type Stat = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export type Screenshot = {
  src: string;
  alt: string;
  caption: string;
};

export type Callout = {
  kind: "tip" | "warning";
  text: string;
};

export type ManualModule = {
  slug: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  screenshots: Screenshot[];
  stats: Stat[];
  tasks: Task[];
  callouts: Callout[];
  related: string[];
};