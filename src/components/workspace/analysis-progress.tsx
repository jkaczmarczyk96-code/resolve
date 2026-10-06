"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleHelp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detailSchema, jobActive, type ProblemDetail } from "@/lib/workspace/contracts";
import { useRemote } from "./remote";
import { ui, useCzech } from "./ui-language";

const stages = [
  { key: "intake", en: "Understand", cs: "Porozumění" },
  { key: "plan", en: "Plan", cs: "Plán" },
  { key: "research", en: "Research", cs: "Výzkum" },
  { key: "verification", en: "Check sources", cs: "Ověření zdrojů" },
  { key: "options", en: "Compare", cs: "Porovnání" },
  { key: "critique", en: "Challenge", cs: "Kontrola rizik" },
  { key: "decision", en: "Recommend", cs: "Doporučení" },
  { key: "tasks", en: "Next steps", cs: "Další kroky" },
] as const;
const active = (detail: ProblemDetail) => jobActive(detail.job);

export function AnalysisProgress({ problemId }: { problemId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cs = useCzech();
  const { data, error, refresh } = useRemote(`/api/problems/${problemId}`, detailSchema, active);
  const status = data?.job?.status;
  const saved = stages.filter(({ key }) => Boolean(data?.snapshot?.[key])).length;
  const next = stages[saved];

  const dismiss = useCallback(() => { sessionStorage.removeItem("avenli-progress-id"); window.dispatchEvent(new Event("avenli-progress")); }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLButtonElement>("button:not([disabled])");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { dismiss(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
      if (!buttons.length) return;
      const firstButton = buttons[0]; const lastButton = buttons.at(-1)!;
      if (event.shiftKey && document.activeElement === firstButton) { event.preventDefault(); lastButton.focus(); }
      else if (!event.shiftKey && document.activeElement === lastButton) { event.preventDefault(); firstButton.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);
  useEffect(() => {
    if (status === "action_required" || status === "completed" || status === "failed") {
      const timer = window.setTimeout(() => {
        sessionStorage.removeItem("avenli-progress-id"); window.dispatchEvent(new Event("avenli-progress"));
        if (status === "action_required") router.replace(`/problems/${problemId}?view=questions`);
      }, status === "action_required" ? 1200 : 500);
      return () => window.clearTimeout(timer);
    }
  }, [status, problemId, router]);

  return <div ref={dialogRef} className="fixed inset-0 z-50 grid place-items-center bg-[#0c1245]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="analysis-progress-title">
    <div className="avenli-panel w-full max-w-xl rounded-[1.75rem] p-6 shadow-[0_30px_100px_rgba(14,18,68,.3)] sm:p-8">
      <div className="flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#efedff] text-primary">{status === "action_required" ? <CircleHelp className="size-6" aria-hidden="true" /> : <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />}</span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Avenli</p><h2 id="analysis-progress-title" className="text-xl font-semibold">{status === "action_required" ? ui(cs,"Avenli needs more information","Avenli potřebuje doplnit informace") : ui(cs, "Working on your problem", "Pracuji na vašem zadání")}</h2></div></div>
      <p role="status" aria-live="polite" className="mt-5 text-sm text-muted-foreground">{error ? ui(cs, "The latest status could not be loaded. Try refreshing it.", "Poslední stav se nepodařilo načíst. Zkuste ho obnovit.") : status === "action_required" ? ui(cs,"Opening the questions so you can continue.","Otevírám dotazy, abyste mohli pokračovat.") : ui(cs, `${saved} of 8 stages saved. ${next ? `Now: ${next.en}.` : "Finishing."}`, `${saved} z 8 kroků uloženo. ${next ? `Nyní: ${next.cs}.` : "Dokončuji."}`)}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0f8]" aria-hidden="true"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4358f4,#7b3cf1)] transition-all" style={{ width: `${saved / 8 * 100}%` }} /></div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label={ui(cs, "Saved analysis stages", "Uložené kroky analýzy")}>{stages.map((stage, index) => <div key={stage.key} className="min-w-0 text-center"><span className={`mx-auto flex size-8 items-center justify-center rounded-full text-xs font-semibold ${index < saved ? "bg-emerald-100 text-emerald-800" : index === saved ? "bg-primary text-white ring-4 ring-primary/10" : "bg-[#eff1fa] text-muted-foreground"}`}>{index < saved ? <Check className="size-4" aria-hidden="true" /> : index + 1}</span><span className="mt-2 block text-[10px] leading-tight text-muted-foreground">{cs ? stage.cs : stage.en}</span></div>)}</div>
      <p className="mt-6 text-xs text-muted-foreground">{ui(cs, "Progress is based on saved results. You may leave this window and return later.", "Postup vychází z uložených výsledků. Okno můžete zavřít a vrátit se později.")}</p>
      <div className="mt-5 flex flex-wrap gap-2"><Button onClick={dismiss}>{ui(cs, "Open workspace", "Otevřít pracovní prostor")}<ArrowRight className="size-4" aria-hidden="true" /></Button>{error && <Button variant="outline" onClick={refresh}>{ui(cs, "Refresh status", "Obnovit stav")}</Button>}</div>
    </div>
  </div>;
}
