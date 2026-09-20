"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Paperclip, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { submissionSchema, webJobSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";
import { trackProductEvent } from "@/lib/product/analytics";

export function NewLiveProblem() {
  const router = useRouter(); const lock = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID()); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  return <div className="space-y-7"><PageHeading eyebrow="New problem" title="What do you need to solve?" description="Tell Avenli what you need to achieve. Be as open-ended as you like." /><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><Panel title="Your starting point"><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (lock.current) return;
    const input = submissionSchema.safeParse({ requestId, description });
    if (!input.success) { setError("Describe your problem using 20–12,000 characters."); return; }
    lock.current = true; setPending(true); setError("");
    try { const job = webJobSchema.parse(await post("/api/problems", input.data)); if (!job.problemId) throw new Error("The saved problem is no longer available."); trackProductEvent("problem_created", "/problems/new"); router.push(`/problems/${job.problemId}`); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to start the analysis."); }
    finally { lock.current = false; setPending(false); }
  }}><label className="block space-y-2 text-sm font-medium"><span>Your problem</span><textarea aria-label="Your problem" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={12000} rows={9} className="block w-full resize-y rounded-2xl border bg-[#fbfbff] p-4 font-normal leading-relaxed shadow-inner" placeholder="Describe the outcome, deadline, budget, constraints, and anything you already know…" /></label><div className="flex items-center gap-2 text-xs text-muted-foreground"><Paperclip className="size-4" aria-hidden="true"/>Files and voice input are planned for a later release.</div><p className="text-sm leading-relaxed text-muted-foreground">Avenli sends the problem to Nebius for analysis and research queries to Tavily. You can follow every saved stage.</p><p className="text-xs text-muted-foreground">One active analysis at a time · Five analyses per 24 hours · Up to three attempts per problem.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending} type="submit" size="lg" className="rounded-xl bg-[linear-gradient(135deg,#4055ef,#7d39ef)]">{pending ? "Starting analysis…" : "Solve this"}</Button></form></Panel><Panel title="Avenli can help with"><ul className="space-y-4 text-sm">{[{icon:Search,text:"Research and analyze options"},{icon:SlidersHorizontal,text:"Compare trade-offs and constraints"},{icon:CheckCircle2,text:"Prepare a clear recommendation"}].map(({icon:Icon,text})=><li key={text} className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eef0ff] text-primary"><Icon className="size-4" aria-hidden="true"/></span>{text}</li>)}</ul><p className="mt-6 border-t pt-5 text-sm font-medium text-primary">Give it a problem. Get it solved.</p></Panel></div></div>;
}
