"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { submissionSchema, webJobSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";
import { trackProductEvent } from "@/lib/product/analytics";
import { ui, useCzech } from "./ui-language";

const examples = [
  "Find an alternative route after a cancelled flight, within my budget and arrival deadline.",
  "Compare two laptops for video editing using current specifications and reliable reviews.",
  "Plan a six-month move abroad and identify the official registration questions I need to verify.",
];

export function NewLiveProblem() {
  const router = useRouter(); const lock = useRef(false);
  const cs = useCzech();
  const [requestId] = useState(() => crypto.randomUUID()); const [description, setDescription] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  return <div className="space-y-7"><PageHeading eyebrow={ui(cs,"New problem","Nové zadání")} title={ui(cs,"What do you need to solve?","Co potřebujete vyřešit?")} description={ui(cs,"Describe the outcome and your constraints. Avenli will organize the rest.","Popište cíl a důležitá omezení. Avenli připraví další postup.")} /><div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"><Panel title={ui(cs,"Your starting point","Vaše zadání")} description={ui(cs,"Write naturally. Include a deadline or budget if it matters.","Pište přirozeně. Pokud záleží na termínu nebo rozpočtu, uveďte je.")}><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (lock.current) return;
    const input = submissionSchema.safeParse({ requestId, description });
    if (!input.success) { setError(ui(cs,"Describe your problem using 20–12,000 characters.","Popište zadání v rozsahu 20–12 000 znaků.")); return; }
    lock.current = true; setPending(true); setError("");
    try { const job = webJobSchema.parse(await post("/api/problems", input.data)); if (!job.problemId) throw new Error("The saved problem is no longer available."); trackProductEvent("problem_created", "/problems/new"); sessionStorage.setItem("avenli-progress-id", job.problemId); router.push(`/problems/${job.problemId}`); }
    catch (error) { setError(error instanceof Error ? error.message : ui(cs,"Unable to start the analysis.","Analýzu se nepodařilo spustit.")); }
    finally { lock.current = false; setPending(false); }
  }}><label className="block space-y-2 text-sm font-medium"><span>{ui(cs,"Your problem","Vaše zadání")}</span><textarea aria-label="Your problem" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={12000} rows={9} className="block w-full resize-y rounded-2xl border bg-[#fbfbff] p-4 font-normal leading-relaxed shadow-[inset_0_2px_8px_rgba(29,35,92,.04)] outline-none transition focus:border-primary/50 focus:ring-4 focus:ring-primary/10" placeholder={ui(cs,"What outcome do you want? What matters most?","Čeho chcete dosáhnout? Co je pro vás důležité?")} /></label><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{ui(cs,"Try an example","Zkuste příklad")}</p><div className="flex flex-wrap gap-2">{examples.map((example, index)=><button key={example} type="button" onClick={()=>setDescription(cs ? ["Najdi alternativní cestu po zrušeném letu v mém rozpočtu a termínu příletu.","Porovnej dva notebooky pro střih videa podle aktuálních parametrů a spolehlivých recenzí.","Naplánuj stěhování do zahraničí a zjisti, které registrační povinnosti musím ověřit."][index] : example)} className="rounded-full border bg-white px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/30 hover:text-primary">{(cs ? ["Zrušený let","Výběr notebooku","Stěhování"] : ["Cancelled flight","Compare laptops","Move abroad"])[index]}</button>)}</div></div><p className="text-xs text-muted-foreground">{ui(cs,"One active analysis · Five per day · Three attempts per problem","Jedna aktivní analýza · Pět denně · Tři pokusy na zadání")}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending} type="submit" size="lg">{pending ? ui(cs,"Starting analysis…","Spouštím analýzu…") : ui(cs,"Solve this","Vyřešit zadání")}</Button></form></Panel><Panel title={ui(cs,"What happens next","Co bude následovat")}><ul className="space-y-4 text-sm">{[{icon:Search,text:ui(cs,"Research relevant sources","Vyhledání relevantních zdrojů")},{icon:SlidersHorizontal,text:ui(cs,"Compare possible approaches","Porovnání možností")},{icon:CheckCircle2,text:ui(cs,"Review a recommendation and tasks","Doporučení a další kroky k posouzení")}].map(({icon:Icon,text})=><li key={text} className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eef0ff] text-primary"><Icon className="size-4" aria-hidden="true"/></span>{text}</li>)}</ul></Panel></div></div>;
}
