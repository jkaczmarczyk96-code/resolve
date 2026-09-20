"use client";

import Link from "next/link";
import { ArrowRight, CircleHelp, Flag, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemo } from "./demo-provider";
import { PageHeading, Panel, ProblemCard } from "./primitives";

export function DemoDashboard() {
  const { account, problems, basePath } = useDemo();
  const query = basePath ? "" : "?demo=1";
  const openTasks = problems.flatMap((problem) => problem.tasks.filter((task) => !task.done));
  const attention = problems.filter((problem) => problem.status === "Needs your input");
  return <div className="space-y-8">
    <PageHeading eyebrow="Your overview" title={account.displayName ? `Welcome, ${account.displayName}` : "Welcome to Avenli"} description="A little clarity on what matters, what’s moving, and what needs you next." actionHref={`${basePath}/problems/new${query}`} />
    <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Problems in this demo", value: problems.length, icon: Flag }, { label: "Need your input", value: attention.length, icon: CircleHelp }, { label: "Open demo tasks", value: openTasks.length, icon: ListChecks }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center justify-between rounded-xl border bg-card p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p></div><Icon className="size-5 text-muted-foreground" aria-hidden="true" /></div>)}</div>
    {attention[0] && <section className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6"><div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Needs your attention · sample</p><h2 className="mt-2 text-lg font-semibold">{attention[0].unknowns[0]?.question}</h2><p className="mt-1 text-sm text-muted-foreground">{attention[0].title} · {attention[0].unknowns[0]?.detail}</p></div><Button asChild variant="outline"><Link href={`${basePath}/problems/${attention[0].id}`}>Review problem<ArrowRight aria-hidden="true" /></Link></Button></section>}
    <section aria-labelledby="active-title"><div className="mb-4 flex items-center justify-between"><h2 id="active-title" className="text-xl font-semibold tracking-tight">Your demo problems</h2><Link href={`${basePath}/problems${query}`} className="text-sm font-medium text-primary hover:underline">View all</Link></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{problems.slice(0, 3).map((problem) => <ProblemCard key={problem.id} problem={problem} />)}</div></section>
    <div className="grid gap-5 xl:grid-cols-2"><Panel title="A clear next step" description="Tasks from the sample scenarios."><ul className="divide-y">{problems.flatMap((problem) => problem.tasks.filter((task) => !task.done).slice(0, 1).map((task) => <li key={task.id}><Link href={`${basePath}/problems/${problem.id}?view=tasks`} className="flex items-start justify-between gap-4 py-3 hover:text-primary"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{problem.title}</p></div><ArrowRight className="mt-1 size-4 shrink-0" aria-hidden="true" /></Link></li>))}</ul></Panel><Panel title="How to explore" description="Try the workspace without running an agent."><ol className="space-y-4 text-sm leading-relaxed"><li><span className="mr-3 text-primary">01</span>Open a scenario and inspect its goal, plan, and open questions.</li><li><span className="mr-3 text-primary">02</span>Compare options and follow the sample decision trail.</li><li><span className="mr-3 text-primary">03</span>Check off a demo task or create a draft of your own.</li></ol></Panel></div>
  </div>;
}
