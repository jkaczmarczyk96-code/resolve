"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/demo/primitives";
import type { ProblemDetail } from "@/lib/workspace/contracts";
import { responseSchema } from "@/lib/workspace/contracts";
import { post } from "./remote";
import { ui, useCzech } from "./ui-language";

export function HumanInput({ id, input, waiting, refresh }: { id: string; input: NonNullable<ProblemDetail["humanRequest"]>; waiting: boolean; refresh: () => void }) {
  const cs = useCzech();
  const draftKey = `avenli-answer-draft:${id}:${input.runId}:${input.round}`;
  const [answers, setAnswers] = useState(() => {
    const blank = input.questions.map(() => "");
    if (typeof window === "undefined") return blank;
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
      return Array.isArray(saved) && saved.length === input.questions.length && saved.every((answer) => typeof answer === "string" && answer.length <= 1200) ? saved as string[] : blank;
    } catch { return blank; }
  });
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const requestId = useRef<string | null>(null); const locked = useRef(false);
  useEffect(() => {
    if (input.answers) try { sessionStorage.removeItem(draftKey); } catch { /* The server response is authoritative. */ }
  }, [draftKey, input.answers]);
  if (input.answers) return <Panel title={ui(cs,"Your saved responses","Uložené odpovědi")} description={ui(cs,"The analysis continues with this information.","Analýza s těmito informacemi pokračuje.")}><dl className="space-y-4">{input.questions.map((question, index) => <div key={index}><dt className="break-words text-sm font-semibold">{question}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{input.answers![index]}</dd></div>)}</dl><Button asChild className="mt-5" variant="outline"><Link href={`/problems/${id}?view=overview`}>{ui(cs,"View progress and result","Zobrazit postup a výsledek")}</Link></Button></Panel>;
  if (!waiting) return null;
  return <Panel title={ui(cs,"Avenli needs your input","Avenli potřebuje doplnit informace")} description={ui(cs,"Answer these questions to continue. If you do not know, say so.","Odpovězte na dotazy, aby analýza mohla pokračovat. Pokud odpověď neznáte, napište to.")}><form className="space-y-5" onSubmit={async (event) => {
    event.preventDefault(); if (locked.current) return;
    requestId.current ??= crypto.randomUUID();
    const value = responseSchema.safeParse({ requestId: requestId.current, runId: input.runId, answers });
    if (!value.success) { setError(ui(cs,"Answer every question using 1–1,200 characters.","Odpovězte na každý dotaz v rozsahu 1–1 200 znaků.")); return; }
    locked.current = true; setPending(true); setError("");
    try { await post(`/api/problems/${id}/respond`, value.data); try { sessionStorage.removeItem(draftKey); } catch { /* The saved server response is authoritative. */ } refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save your answers."); }
    finally { locked.current = false; setPending(false); }
  }}>{input.questions.map((question, index) => <label className="block space-y-2 text-sm" key={index}><span className="block break-words font-medium">{question}</span><textarea disabled={pending} required value={answers[index]} maxLength={1200} rows={3} className="block w-full rounded-lg border bg-background p-3" onChange={(event) => {
    const next = answers.map((answer, position) => position === index ? event.target.value : answer);
    setAnswers(next);
    try { sessionStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* The form remains usable when storage is unavailable. */ }
  }} /></label>)}<p className="text-xs leading-relaxed text-muted-foreground">{ui(cs,"Your draft stays in this tab until you submit it. Submitted answers update this saved analysis.","Rozepsané odpovědi zůstanou v této kartě až do odeslání. Odeslané odpovědi doplní uloženou analýzu.")}</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending}>{pending ? ui(cs,"Saving answers…","Ukládám odpovědi…") : ui(cs,"Save answers and continue","Uložit odpovědi a pokračovat")}</Button></form></Panel>;
}
