"use client";
import { useState } from "react";
import Link from "next/link";
import { CircleHelp, CheckCircle2, Clock3, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, EmptyState } from "@/components/demo/primitives";
import { useDemo } from "@/components/demo/demo-provider";
import { jobActive, listSchema, problemLabel, type ProblemList } from "@/lib/workspace/contracts";
import { useRemote } from "./remote";
const active = (list: ProblemList) => list.some((item) => item.problem.status !== "solved" && jobActive(item.job));

export function LiveProblemList({ overview = false }: { overview?: boolean }) {
  const { account } = useDemo(); const { data, error, refresh } = useRemote("/api/problems", listSchema, active);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("All");
  const filtered = (data ?? []).filter(({ problem, job }) => (problem.title + problem.original_input).toLowerCase().includes(search.toLowerCase()) && (status === "All" || problemLabel(problem,job) === status));
  const ready = (data ?? []).filter(({ problem,job }) => problemLabel(problem,job) === "Ready to review").length;
  const waiting = (data ?? []).filter(({ problem,job }) => problemLabel(problem,job) === "Needs your input").length;
  const activeCount = (data ?? []).filter(({ problem,job }) => problem.status !== "solved" && jobActive(job)).length;
  return <div className="space-y-7">
    <PageHeading eyebrow={overview ? "Your workspace" : "Problems"} title={overview ? `Welcome${account.displayName ? `, ${account.displayName}` : ""}` : "Your problems"} description="Your problems and analysis results are saved to your account." action />
    {overview && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Problems",value:data?.length??"—",icon:FolderKanban},{label:"In progress",value:activeCount,icon:Clock3},{label:"Need your input",value:waiting,icon:CircleHelp},{label:"Ready to review",value:ready,icon:CheckCircle2}].map(({label,value,icon:Icon})=><div key={label} className="flex items-center justify-between rounded-2xl border border-[#e5e7f3] bg-white p-5 shadow-[0_8px_28px_rgba(28,32,92,.04)]"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-[#111653]">{value}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-[#eff0ff] text-[#4d42e6]"><Icon className="size-5" aria-hidden="true"/></span></div>)}</div><div className="flex flex-wrap gap-3 rounded-2xl border border-[#dedffd] bg-[linear-gradient(135deg,#f8f7ff,#eef5ff)] p-5 text-sm"><p className="flex-1 text-muted-foreground">Give Avenli a problem. Follow its research, review the recommendation, and inspect the proposed tasks.</p><Link className="font-medium text-primary hover:underline" href="/dashboard?demo=1">Explore demo</Link></div></>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search problems" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your problems" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3" /><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border bg-background px-3">{["All", "Queued", "Analyzing", "Needs your input", "Ready to review", "Solved", "Needs retry", "Interrupted", "Not started"].map((item) => <option key={item}>{item}</option>)}</select><Button variant="outline" onClick={refresh}>Refresh</Button></div>
    {error && <p role="alert" className="rounded-lg border p-4 text-sm">{error} <Link href="/login" className="text-primary underline">Sign in</Link></p>}
    {!data && !error && <p role="status">Loading your problems…</p>}
    {data && !filtered.length && <EmptyState title={data.length ? "No matching problems" : "What would you like to solve?"} detail={data.length ? "Try a different search or status." : "Create your first problem to start an analysis."}>{data.length ? <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatus("All"); }}>Clear filters</Button> : <Button asChild className="mt-4"><Link href="/problems/new">Create a problem</Link></Button>}</EmptyState>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, overview ? 6 : 100).map(({ problem, job }) => <Link key={problem.id} href={`/problems/${problem.id}`} className="group min-w-0 rounded-2xl border border-[#e4e6f1] bg-white p-5 shadow-[0_8px_28px_rgba(28,32,92,.04)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_38px_rgba(44,42,126,.1)]"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{problemLabel(problem,job)}</p><h2 className="mt-3 break-words text-lg font-semibold text-[#151955] group-hover:text-primary">{problem.title}</h2><p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{problem.original_input}</p><p className="mt-5 text-xs text-muted-foreground">{problem.solved_at ? `Solved ${new Date(problem.solved_at).toLocaleDateString()}` : `Saved ${new Date(problem.created_at).toLocaleDateString()}`}</p></Link>)}</div>
    {overview && Boolean(data?.length) && <Link href="/problems" className="text-sm font-medium text-primary hover:underline">All problems →</Link>}
    {!overview && <p className="text-xs text-muted-foreground">Showing up to 100 recent problems. <Link href="/problems?demo=1" className="text-primary underline">Browse fictional examples</Link></p>}
  </div>;
}
