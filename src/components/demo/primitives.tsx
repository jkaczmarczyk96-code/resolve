"use client";

import { ArrowUpRight, BriefcaseBusiness, Compass, House, Plane, Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DemoProblem, DemoStatus } from "@/lib/demo/types";
import { useDemo } from "./demo-provider";

export function StatusBadge({ status }: { status: DemoStatus }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", status === "Needs your input" ? "bg-amber-50 text-amber-900" : status === "Ready to review" ? "bg-emerald-50 text-emerald-800" : "bg-secondary text-secondary-foreground")}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{status}</span>;
}

export function CategoryIcon({ category }: { category: DemoProblem["category"] }) {
  const Icon = { Travel: Plane, Life: House, Work: BriefcaseBusiness, Personal: Compass }[category];
  return <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></span>;
}

export function PageHeading({ eyebrow, title, description, action = false, demo = false, actionHref }: { eyebrow: string; title: string; description: string; action?: boolean; demo?: boolean; actionHref?: string }) {
  const href = actionHref ?? (action ? (demo ? "/problems/new?demo=1" : "/problems/new") : undefined);
  return <div className="flex flex-wrap items-start justify-between gap-5"><div className="space-y-2"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-primary">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-.045em] text-[#0e1450] sm:text-[2.5rem] sm:leading-tight">{title}</h1><p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p></div>{href && <Button asChild size="lg"><Link href={href}><Plus aria-hidden="true" />New problem</Link></Button>}</div>;
}

export function Panel({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <section className={cn("avenli-panel rounded-[1.25rem] p-5 sm:p-6", className)}><h2 className="text-[1.05rem] font-semibold tracking-[-.02em] text-[#111653]">{title}</h2>{description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}<div className="mt-5">{children}</div></section>;
}

export function EmptyState({ title, detail, children }: { title: string; detail: string; children?: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center"><Compass className="mx-auto mb-4 size-6 text-muted-foreground" aria-hidden="true" /><h2 className="font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{detail}</p>{children && <div className="mt-5">{children}</div>}</div>;
}

export function ProblemCard({ problem }: { problem: DemoProblem }) {
  const { basePath } = useDemo();
  const completed = problem.tasks.filter((task) => task.done).length;
  return <Link href={`${basePath}/problems/${problem.id}`} className="group flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-start justify-between gap-3"><CategoryIcon category={problem.category} /><StatusBadge status={problem.status} /></div>
    <div className="mt-5 flex-1"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{problem.category} · {problem.status === "Draft" ? "Your demo draft" : "Sample scenario"}</p><h2 className="mt-2 text-lg font-semibold tracking-tight group-hover:text-primary">{problem.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{problem.goal}</p></div>
    <div className="mt-6"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Illustrative progress</span><span>{problem.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${problem.progress}%` }} /></div></div>
    <div className="mt-4 flex justify-between text-sm text-muted-foreground"><span>{completed}/{problem.tasks.length} demo tasks complete</span><ArrowUpRight className="size-4 text-primary" aria-hidden="true" /></div>
  </Link>;
}
