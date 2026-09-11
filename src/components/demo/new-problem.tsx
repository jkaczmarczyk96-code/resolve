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
  const { addDraft } = useDemo();
  const router = useRouter();
  return <div className="mx-auto max-w-3xl space-y-8"><PageHeading eyebrow="Start with the outcome" title="What do you need to solve?" description="Describe the outcome you need, not the steps." /><form onSubmit={(event) => { event.preventDefault(); const result = draftInputSchema.safeParse(input); if (!result.success) { setError(result.error.issues[0].message); return; } router.push(`/problems/${addDraft(result.data)}`); }} className="space-y-4 rounded-xl border bg-card p-5 sm:p-7"><label htmlFor="new-problem" className="block text-sm font-medium">Your problem</label><textarea id="new-problem" rows={7} maxLength={2000} aria-describedby={error ? "draft-error draft-note" : "draft-note"} aria-invalid={Boolean(error)} placeholder="I need to… Here’s the situation, what matters, and what I already know." className="w-full resize-y rounded-lg border bg-background p-4 leading-relaxed outline-ring placeholder:text-muted-foreground" value={input} onChange={(event) => { setInput(event.target.value); setError(undefined); }} /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{input.length}/2,000 characters</p><Button type="submit">Create demo draft<ArrowRight aria-hidden="true" /></Button></div>{error && <p id="draft-error" role="alert" className="text-sm text-destructive">{error}</p>}<p id="draft-note" className="border-t pt-4 text-sm leading-relaxed text-muted-foreground">This creates a draft in this open preview only. It is not saved to your account and no AI analysis runs. Reloading or signing out clears it.</p></form><section><h2 className="text-lg font-semibold">Or explore a sample problem</h2><div className="mt-4 space-y-3">{demoProblems.map((problem) => <Link key={problem.id} href={`/problems/${problem.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"><CategoryIcon category={problem.category} /><div className="flex-1"><p className="font-medium">{problem.title}</p><p className="mt-1 text-xs text-muted-foreground">Fictional scenario · {problem.category}</p></div><ArrowRight className="size-4 text-primary" aria-hidden="true" /></Link>)}</div></section></div>;
}
