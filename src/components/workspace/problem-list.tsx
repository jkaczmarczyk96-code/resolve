"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeading, EmptyState } from "@/components/demo/primitives";
import { useDemo } from "@/components/demo/demo-provider";
import { jobActive, jobLabel, listSchema, type ProblemList } from "@/lib/workspace/contracts";
import { useRemote } from "./remote";
const active = (list: ProblemList) => list.some((item) => jobActive(item.job));

export function LiveProblemList({ overview = false }: { overview?: boolean }) {
  const { account } = useDemo(); const { data, error, refresh } = useRemote("/api/problems", listSchema, active);
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("All");
  const filtered = (data ?? []).filter(({ problem, job }) => (problem.title + problem.original_input).toLowerCase().includes(search.toLowerCase()) && (status === "All" || jobLabel(job) === status));
  return <div className="space-y-7">
    <PageHeading eyebrow={overview ? "Your workspace" : "Problems"} title={overview ? `Welcome${account.displayName ? `, ${account.displayName}` : ""}` : "Your problems"} description="Your problems and analysis results are saved to your account." action />
    {overview && <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-5 text-sm"><p className="flex-1 text-muted-foreground">Give Resolve a problem. Follow its research, review the recommendation, and inspect the proposed tasks.</p><Link className="font-medium text-primary hover:underline" href="/dashboard?demo=1">Explore demo</Link></div>}
    <div className="flex flex-wrap gap-3"><input aria-label="Search problems" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your problems" className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3" /><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border bg-background px-3">{["All", "Queued", "Analyzing", "Needs your input", "Ready to review", "Needs retry", "Interrupted", "Not started"].map((item) => <option key={item}>{item}</option>)}</select><Button variant="outline" onClick={refresh}>Refresh</Button></div>
    {error && <p role="alert" className="rounded-lg border p-4 text-sm">{error} <Link href="/login" className="text-primary underline">Sign in</Link></p>}
    {!data && !error && <p role="status">Loading your problems…</p>}
    {data && !filtered.length && <EmptyState title={data.length ? "No matching problems" : "What would you like to solve?"} detail={data.length ? "Try a different search or status." : "Create your first problem to start an analysis."}>{data.length ? <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setStatus("All"); }}>Clear filters</Button> : <Button asChild className="mt-4"><Link href="/problems/new">Create a problem</Link></Button>}</EmptyState>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, overview ? 6 : 100).map(({ problem, job }) => <Link key={problem.id} href={`/problems/${problem.id}`} className="min-w-0 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50"><p className="text-xs font-medium text-primary">{jobLabel(job)}</p><h2 className="mt-3 break-words text-lg font-semibold">{problem.title}</h2><p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{problem.original_input}</p><p className="mt-5 text-xs text-muted-foreground">Saved {new Date(problem.created_at).toLocaleDateString()}</p></Link>)}</div>
    {overview && Boolean(data?.length) && <Link href="/problems" className="text-sm font-medium text-primary hover:underline">All problems →</Link>}
    {!overview && <p className="text-xs text-muted-foreground">Showing up to 100 recent problems. <Link href="/problems?demo=1" className="text-primary underline">Browse fictional examples</Link></p>}
  </div>;
}
