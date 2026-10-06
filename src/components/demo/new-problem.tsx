"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { draftInputSchema } from "@/lib/demo/draft";
import { demoProblems } from "@/lib/demo/data";
import { useDemo } from "./demo-provider";
import { CategoryIcon, PageHeading } from "./primitives";

export function NewDemoProblem() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const { addDraft, basePath } = useDemo();
  const router = useRouter();
  return <div className="mx-auto max-w-4xl space-y-5">
    <PageHeading eyebrow="Start with the outcome" title="What do you need to solve?" description="Describe the outcome you need, not the steps." />
    <form onSubmit={(event) => { event.preventDefault(); const result = draftInputSchema.safeParse(input); if (!result.success) { setError(result.error.issues[0].message); return; } router.push(`${basePath}/problems/${addDraft(result.data)}`); }} className="avenli-panel space-y-3 rounded-2xl p-4 sm:p-5">
      <label htmlFor="new-problem" className="block text-sm font-medium">Your problem</label>
      <textarea id="new-problem" rows={5} maxLength={2000} aria-describedby={error ? "draft-error draft-note" : "draft-note"} aria-invalid={Boolean(error)} placeholder="I need to… Here’s the situation, what matters, and what I already know." className="w-full resize-y rounded-xl border bg-background p-4 leading-relaxed outline-ring placeholder:text-muted-foreground" value={input} onChange={(event) => { setInput(event.target.value); setError(undefined); }} />
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{input.length}/2,000 characters</p><Button type="submit">Create demo draft<ArrowRight aria-hidden="true" /></Button></div>
      {error && <p id="draft-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <p id="draft-note" className="border-t pt-3 text-xs leading-5 text-muted-foreground">Demo drafts stay in this preview only. No AI runs; a reload clears them.</p>
    </form>
    <section><h2 className="text-sm font-semibold">Or explore a sample problem</h2><div className="mt-2.5 grid gap-2 sm:grid-cols-3">{demoProblems.map((problem) => <Link key={problem.id} href={`${basePath}/problems/${problem.id}`} className="avenli-panel group flex min-w-0 items-center gap-2.5 rounded-xl p-3 transition hover:border-primary/40"><CategoryIcon category={problem.category} /><span className="min-w-0 flex-1 text-sm font-medium leading-5 group-hover:text-primary">{problem.title}</span><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /></Link>)}</div></section>
  </div>;
}
