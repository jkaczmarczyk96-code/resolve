"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Search, Sparkles } from "lucide-react";
import { AvenliMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { post } from "./remote";

const steps = [
  { icon: Sparkles, title: "Tell Avenli what you need to achieve.", detail: "Share the outcome, constraints, deadline, and what you already know." },
  { icon: Search, title: "Avenli researches, plans, and evaluates.", detail: "Follow the analysis and inspect sources, options, risks, and proposed next steps." },
  { icon: CheckCircle2, title: "You stay in control.", detail: "Answer questions and approve the exact external action before Avenli changes anything." },
] as const;

export function Onboarding({ open }: { open: boolean }) {
  const [visible, setVisible] = useState(open); const [step, setStep] = useState(0); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const firstButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (visible) firstButton.current?.focus(); }, [visible, step]);
  if (!visible) return null;
  async function finish(outcome: "completed" | "skipped") {
    if (pending) return; setPending(true); setError("");
    try { await post("/api/account/onboarding", { outcome }); setVisible(false); }
    catch { setError("We could not save this choice. Try again."); }
    finally { setPending(false); }
  }
  const item = steps[step]; const Icon = item.icon;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#090d3d]/55 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-detail" className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
      <div className="bg-[linear-gradient(135deg,#f7f5ff,#edf4ff)] px-6 py-6 sm:px-9"><div className="flex items-center justify-between"><AvenliMark className="size-11"/><span className="text-xs font-semibold uppercase tracking-[.18em] text-[#4f55a5]">Welcome · {step + 1} of 3</span></div></div>
      <div className="px-6 py-7 sm:px-9 sm:py-9"><div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4e3ef0]"><Icon className="size-6" aria-hidden="true"/></div><h1 id="onboarding-title" className="text-2xl font-semibold tracking-tight text-[#111753] sm:text-3xl">{item.title}</h1><p id="onboarding-detail" className="mt-3 leading-relaxed text-muted-foreground">{item.detail}</p>
        <div className="mt-8 flex gap-2" aria-label="Onboarding progress">{steps.map((_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[#5a42f4]" : "bg-[#e7e9f4]"}`} aria-hidden="true"/>)}</div>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Button ref={firstButton} variant="ghost" disabled={pending} onClick={() => finish("skipped")}>Skip tour</Button>{step < steps.length - 1 ? <Button disabled={pending} onClick={() => setStep(step + 1)}>Continue <ArrowRight aria-hidden="true"/></Button> : <Button disabled={pending} onClick={() => finish("completed")}>{pending ? "Saving…" : "Create your first problem"} <ArrowRight aria-hidden="true"/></Button>}</div>
      </div>
    </section>
  </div>;
}
