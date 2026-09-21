"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleHelp, CheckCircle2, Clock3, FolderKanban, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeading } from "@/components/demo/primitives";
import { useDemo } from "@/components/demo/demo-provider";
import { jobActive, listSchema, problemLabel, type ProblemList } from "@/lib/workspace/contracts";
import { useRemote } from "./remote";

const active = (list: ProblemList) => list.some((item) => item.problem.status !== "solved" && jobActive(item.job));

export function LiveProblemList({ overview = false }: { overview?: boolean }) {
  const { account } = useDemo();
  const { data, error, refresh } = useRemote("/api/problems", listSchema, active);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = (data ?? []).filter(({ problem, job }) =>
    (problem.title + problem.original_input).toLowerCase().includes(search.toLowerCase()) &&
    (status === "All" || problemLabel(problem, job) === status));
  const ready = (data ?? []).filter(({ problem, job }) => problemLabel(problem, job) === "Ready to review").length;
  const waiting = (data ?? []).filter(({ problem, job }) => problemLabel(problem, job) === "Needs your input").length;
  const activeCount = (data ?? []).filter(({ problem, job }) => problem.status !== "solved" && jobActive(job)).length;
  const dueTasks = (data ?? []).reduce((total, item) => total + item.dueTaskCount, 0);
  const recent = filtered.slice(0, overview ? 6 : 100);

  return <div className="space-y-7">
    <PageHeading eyebrow={overview ? "Your workspace" : "Problems"} title={overview ? `Welcome${account.displayName ? `, ${account.displayName}` : ""}` : "Your problems"} description="Your problems and analysis results are saved to your account." action />
    {overview && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      { label: "Problems", value: data?.length ?? "—", icon: FolderKanban },
      { label: "In progress", value: activeCount, icon: Clock3 },
      { label: "Need your input", value: waiting, icon: CircleHelp },
      { label: "Ready to review", value: ready, icon: CheckCircle2 },
      { label: "Due soon", value: dueTasks, icon: CalendarClock },
    ].map(({ label, value, icon: Icon }) => <div key={label} className="avenli-panel flex items-center justify-between rounded-[1.15rem] p-4"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-.04em] text-[#111653]">{value}</p></div><span className="flex size-9 items-center justify-center rounded-xl bg-[#eff0ff] text-[#4d42e6]"><Icon className="size-[18px]" aria-hidden="true" /></span></div>)}</div>}
    {!overview && <div className="flex flex-wrap gap-3"><input aria-label="Search problems" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your problems" className="h-11 min-w-0 flex-1 rounded-xl border bg-white/90 px-3.5 shadow-sm" /><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-xl border bg-white/90 px-3.5 shadow-sm">{["All", "Queued", "Analyzing", "Needs your input", "Ready to review", "Solved", "Needs retry", "Interrupted", "Not started"].map((item) => <option key={item}>{item}</option>)}</select><Button variant="outline" onClick={refresh}>Refresh</Button></div>}
    {error && <p role="alert" className="rounded-xl border bg-white p-4 text-sm">{error} <Link href="/login" className="text-primary underline">Sign in</Link></p>}
    {!data && !error && <p role="status">Loading your problems…</p>}
    {data && !filtered.length && <EmptyState title={data.length ? "No matching problems" : "What would you like to solve?"} detail={data.length ? "Try a different search or status." : "Create your first problem to start an analysis."}>{data.length ? <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatus("All"); }}>Clear filters</Button> : <Button asChild className="mt-4"><Link href="/problems/new">Create a problem</Link></Button>}</EmptyState>}
    {overview && Boolean(recent.length) && <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
      <section className="avenli-panel overflow-hidden rounded-[1.25rem]"><div className="flex items-center justify-between border-b px-5 py-4 sm:px-6"><div><h2 className="font-semibold tracking-[-.02em] text-[#111653]">Recent problems</h2><p className="mt-1 text-xs text-muted-foreground">Pick up where you left off.</p></div><Link href="/problems" className="text-sm font-semibold text-primary hover:underline">View all</Link></div><div className="divide-y">{recent.map(({ problem, job, dueTaskCount }) => <Link key={problem.id} href={`/problems/${problem.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[#f8f9ff] sm:px-6"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(145deg,#eef0ff,#f4edff)] text-primary"><FolderKanban className="size-[18px]" aria-hidden="true" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-[#151955] group-hover:text-primary">{problem.title}</h3>{dueTaskCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{dueTaskCount} due</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{problem.original_input}</p></div><span className="hidden rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground sm:inline-flex">{problemLabel(problem, job)}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" /></Link>)}</div></section>
      <aside className="avenli-glow relative flex min-h-72 flex-col overflow-hidden rounded-[1.25rem] border border-[#d9def6] p-6"><div className="absolute -right-16 -top-16 size-52 rounded-full bg-violet-300/25 blur-3xl" aria-hidden="true" /><div className="relative"><span className="flex size-11 items-center justify-center rounded-2xl bg-white/80 text-primary shadow-sm"><Sparkles className="size-5" aria-hidden="true" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-[#5d5da5]">Keep going</p><h2 className="mt-2 max-w-xs text-2xl font-semibold leading-tight tracking-[-.04em] text-[#111653]">Turn complex problems into clear next steps.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Avenli researches, compares and keeps the final decision in your hands.</p></div><div className="relative mt-auto flex flex-wrap gap-3 pt-6"><Button asChild><Link href="/problems/new"><Plus aria-hidden="true" />New problem</Link></Button><Button asChild variant="outline"><Link href="/dashboard?demo=1">Explore demo</Link></Button></div></aside>
    </div>}
    {!overview && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{recent.map(({ problem, job, dueTaskCount }) => <Link key={problem.id} href={`/problems/${problem.id}`} className="avenli-panel group min-w-0 rounded-[1.25rem] p-5 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_45px_rgba(44,42,126,.1)]"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">{problemLabel(problem, job)}</p>{dueTaskCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{dueTaskCount} due</span>}</div><h2 className="mt-3 break-words text-lg font-semibold text-[#151955] group-hover:text-primary">{problem.title}</h2><p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{problem.original_input}</p><p className="mt-5 text-xs text-muted-foreground">{problem.solved_at ? `Solved ${new Date(problem.solved_at).toLocaleDateString()}` : `Saved ${new Date(problem.created_at).toLocaleDateString()}`}</p></Link>)}</div>}
    {!overview && <p className="text-xs text-muted-foreground">Showing up to 100 recent problems. <Link href="/problems?demo=1" className="text-primary underline">Browse fictional examples</Link></p>}
  </div>;
}
