"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/demo/primitives";
import type { ProblemDetail } from "@/lib/workspace/contracts";
import { responseSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";

export function HumanInput({ id, input, waiting, refresh }: { id: string; input: NonNullable<ProblemDetail["humanRequest"]>; waiting: boolean; refresh: () => void }) {
  const [answers, setAnswers] = useState(() => input.questions.map(() => ""));
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null); const locked = useRef(false);
  if (input.answers) return <Panel title="Your saved responses" description="These are your reported details, not independently verified facts."><dl className="space-y-4">{input.questions.map((question, index) => <div key={index}><dt className="break-words text-sm font-semibold">{question}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{input.answers![index]}</dd></div>)}</dl></Panel>;
  if (!waiting) return null;
  return <Panel title="Avenli needs your input" description="Answer these questions so the analysis can continue. If you do not know, say so; Avenli will keep that uncertainty."><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (locked.current) return;
    requestId.current ??= crypto.randomUUID();
    const value = responseSchema.safeParse({ requestId: requestId.current, runId: input.runId, answers });
    if (!value.success) { setError("Answer every question using 1–1,200 characters."); return; }
    locked.current = true; setPending(true); setError("");
    try { await post(`/api/problems/${id}/respond`, value.data); refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save your answers."); }
    finally { locked.current = false; setPending(false); }
  }}>{input.questions.map((question, index) => <label className="block space-y-2 text-sm" key={index}><span className="block break-words font-medium">{question}</span><textarea disabled={pending} required value={answers[index]} maxLength={1200} rows={3} className="block w-full rounded-lg border bg-background p-3" onChange={(event) => setAnswers((current) => current.map((answer, position) => position === index ? event.target.value : answer))} /></label>)}<p className="text-xs leading-relaxed text-muted-foreground">Answers are saved when you submit and sent to Nebius to update the plan. Revised research questions are sent to Tavily. Continuing keeps this analysis and its saved progress.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending}>{pending ? "Saving answers…" : "Save answers and continue"}</Button></form></Panel>;
}
