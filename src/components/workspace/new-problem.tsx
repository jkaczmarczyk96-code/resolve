"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { submissionSchema, webJobSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";

export function NewLiveProblem() {
  const router = useRouter(); const lock = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID()); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  return <div className="max-w-3xl space-y-7"><PageHeading eyebrow="New problem" title="What would you like to solve?" description="Describe the outcome, constraints and anything you already know." /><Panel title="Your starting point"><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (lock.current) return;
    const input = submissionSchema.safeParse({ requestId, description });
    if (!input.success) { setError("Describe your problem using 20–12,000 characters."); return; }
    lock.current = true; setPending(true); setError("");
    try { const job = webJobSchema.parse(await post("/api/problems", input.data)); if (!job.problemId) throw new Error("The saved problem is no longer available."); router.push(`/problems/${job.problemId}`); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to start the analysis."); }
    finally { lock.current = false; setPending(false); }
  }}><label className="block space-y-2 text-sm font-medium"><span>Your problem</span><textarea aria-label="Your problem" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={12000} rows={8} className="block w-full rounded-lg border bg-background p-3 font-normal leading-relaxed" placeholder="I need to… My budget is… The deadline is…" /></label><p className="text-sm leading-relaxed text-muted-foreground">Resolve will save this problem and send its description to Nebius for analysis. Research questions are sent to Tavily. You can follow the progress after starting.</p><p className="text-xs text-muted-foreground">One active analysis at a time · Five analyses per 24 hours · Up to three attempts per problem.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending} type="submit">{pending ? "Starting analysis…" : "Resolve it"}</Button></form></Panel></div>;
}
