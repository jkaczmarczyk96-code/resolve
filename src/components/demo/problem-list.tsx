"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DemoStatus } from "@/lib/demo/types";
import { useDemo } from "./demo-provider";
import { EmptyState, PageHeading, ProblemCard } from "./primitives";

export function DemoProblemList() {
  const { problems, basePath } = useDemo();
  const routeQuery = basePath ? "" : "?demo=1";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DemoStatus | "All">("All");
  const filtered = problems.filter((problem) => (status === "All" || problem.status === status) && `${problem.title} ${problem.goal}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="space-y-7"><PageHeading eyebrow="Problem library" title="A place for every outcome" description="Pick up a sample scenario or keep shaping a draft in this preview." actionHref={`${basePath}/problems/new${routeQuery}`} /><div className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="max-w-lg flex-1"><label htmlFor="problem-search" className="mb-2 block text-sm font-medium">Search problems</label><div className="relative"><Search className="absolute left-3 top-3 size-5 text-muted-foreground" aria-hidden="true" /><Input id="problem-search" type="search" placeholder="Search by goal or title" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" /></div></div><div><label htmlFor="problem-status" className="mb-2 block text-sm font-medium">Status</label><select id="problem-status" className="h-11 w-full rounded-md border bg-card px-3 text-sm sm:w-48" value={status} onChange={(event) => setStatus(event.target.value as DemoStatus | "All")}>{["All", "Needs your input", "Ready to review", "Waiting", "Draft"].map((value) => <option key={value}>{value}</option>)}</select></div></div><p aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "problem" : "problems"}</p>{filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((problem) => <ProblemCard key={problem.id} problem={problem} />)}</div> : <EmptyState title="No matching problems" detail="Try a different search or status."><Button variant="outline" onClick={() => { setQuery(""); setStatus("All"); }}>Clear filters</Button></EmptyState>}</div>;
}
