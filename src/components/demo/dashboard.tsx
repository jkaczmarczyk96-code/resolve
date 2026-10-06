"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleHelp, FolderKanban, ListChecks } from "lucide-react";
import { BrandLandscape } from "@/components/brand-landscape";
import { Button } from "@/components/ui/button";
import { useDemo } from "./demo-provider";
import { CategoryIcon, PageHeading, StatusBadge } from "./primitives";

export function DemoDashboard() {
  const { account, problems, basePath } = useDemo();
  const query = basePath ? "" : "?demo=1";
  const openTasks = problems.flatMap((problem) => problem.tasks.filter((task) => !task.done));
  const attention = problems.find((problem) => problem.status === "Needs your input");
  const ready = problems.find((problem) => problem.status === "Ready to review");
  const stats = [
    { label: "Problems", value: problems.length, icon: FolderKanban },
    { label: "Need your input", value: problems.filter((problem) => problem.status === "Needs your input").length, icon: CircleHelp },
    { label: "Open demo tasks", value: openTasks.length, icon: ListChecks },
    { label: "Ready to review", value: problems.filter((problem) => problem.status === "Ready to review").length, icon: CheckCircle2 },
  ];

  return <div className="space-y-5">
    <PageHeading eyebrow="Your overview" title={account.displayName ? `Welcome, ${account.displayName}` : "Welcome to Avenli"} description="A little clarity on what matters, what’s moving, and what needs you next." actionHref={`${basePath}/problems/new${query}`} />
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon }) =>
      <div key={label} className="avenli-panel flex items-center justify-between rounded-2xl p-3 sm:p-4"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-.04em] text-[#111653]">{value}</p></div><span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#eff0ff] text-primary"><Icon className="size-[17px]" aria-hidden="true" /></span></div>
    )}</div>
    {attention && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5"><div className="max-w-xl"><p className="text-[10px] font-semibold uppercase tracking-wider text-amber-900">Needs your attention · sample</p><h2 className="mt-1 text-base font-semibold">{attention.unknowns[0]?.question}</h2><p className="mt-0.5 text-xs text-muted-foreground">{attention.title} · {attention.unknowns[0]?.detail}</p></div><Button asChild size="sm" variant="outline"><Link href={`${basePath}/problems/${attention.id}`}>Review problem<ArrowRight aria-hidden="true" /></Link></Button></section>}
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)]">
      <section aria-labelledby="active-title" className="avenli-panel overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5"><div><h2 id="active-title" className="font-semibold tracking-[-.02em] text-[#111653]">Recent problems</h2><p className="mt-0.5 text-xs text-muted-foreground">Explore a complete fictional workspace.</p></div><Link href={`${basePath}/problems${query}`} className="text-sm font-semibold text-primary hover:underline">View all</Link></div><div className="divide-y">{problems.map((problem) => <Link key={problem.id} href={`${basePath}/problems/${problem.id}`} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[#f8f9ff] sm:px-5"><CategoryIcon category={problem.category}/><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-[#151955] group-hover:text-primary">{problem.title}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{problem.goal}</p></div><span className="hidden sm:inline-flex"><StatusBadge status={problem.status}/></span><ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true"/></Link>)}</div></section>
      <aside className="relative isolate flex min-h-64 flex-col overflow-hidden rounded-2xl border border-[#d9def6] bg-[linear-gradient(145deg,#f9faff,#e7ecff)] p-5"><BrandLandscape className="absolute inset-x-0 bottom-0 -z-10 h-40 w-full opacity-65"/><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Keep going</p><h2 className="mt-2 max-w-xs text-xl font-semibold leading-tight tracking-[-.04em] text-[#111653]">Turn complex problems into clear next steps.</h2><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">A sample result shows how Avenli keeps evidence, decisions and tasks together.</p>{ready && <Link href={`${basePath}/problems/${ready.id}`} className="mt-auto inline-flex w-fit items-center gap-1 pt-5 text-sm font-semibold text-primary hover:underline">Explore a result<ArrowRight className="size-4" aria-hidden="true"/></Link>}</aside>
    </div>
    {openTasks.length > 0 && <details className="avenli-panel rounded-2xl px-4 py-3.5"><summary className="cursor-pointer text-sm font-semibold">Open tasks in the demo <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-primary">{openTasks.length}</span></summary><ul className="mt-3 divide-y border-t pt-2">{problems.flatMap((problem) => problem.tasks.filter((task) => !task.done).slice(0, 1).map((task) => <li key={task.id}><Link href={`${basePath}/problems/${problem.id}?view=tasks`} className="flex items-start justify-between gap-4 py-2.5 hover:text-primary"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{problem.title}</p></div><ArrowRight className="mt-1 size-4 shrink-0" aria-hidden="true" /></Link></li>))}</ul></details>}
  </div>;
}
