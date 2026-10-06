"use client";
import { useRef,useState } from "react";
import Link from "next/link";
import { CalendarPlus,ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/demo/primitives";
import { actionProposalSchema,type ActionAccess,type ExternalAction } from "@/lib/actions/contracts";
import { post } from "./remote";
import { trackProductEvent } from "@/lib/product/analytics";
import { ui, useCzech } from "./ui-language";

const labels={ proposed:"Awaiting approval",executing:"Creating event",succeeded:"Created",failed:"Failed",cancelled:"Cancelled" } as const;
const labelsCs: Record<keyof typeof labels,string> = { proposed:"Čeká na schválení",executing:"Vytváří se událost",succeeded:"Vytvořeno",failed:"Selhalo",cancelled:"Zrušeno" };

export function CalendarActions({ id,title,actions,access,analysisComplete,refresh }:{ id:string;title:string;actions:ExternalAction[];access:ActionAccess;analysisComplete:boolean;refresh:()=>void }) {
  const cs=useCzech();
  const [values,setValues]=useState({ summary:title.slice(0,200),description:"",location:"",start:"",end:"" });
  const [pending,setPending]=useState(""); const [error,setError]=useState(""); const [reviewing,setReviewing]=useState<string|null>(null);
  const requestId=useRef<string|null>(null);
  async function submit() {
    const start=new Date(values.start); const end=new Date(values.end);
    const parsed=actionProposalSchema.safeParse({ requestId:requestId.current??crypto.randomUUID(),payload:{ ...values,start:Number.isNaN(start.valueOf()) ? "" : start.toISOString(),end:Number.isNaN(end.valueOf()) ? "" : end.toISOString() } });
    if (!parsed.success || Date.parse(parsed.data.payload.start)<Date.now()-300_000) { setError(ui(cs,"Choose a title and a future start and end time. Events may last up to seven days.","Zadejte název a budoucí začátek i konec. Událost může trvat nejvýše sedm dní.")); return; }
    requestId.current=parsed.data.requestId; setPending("proposal"); setError("");
    try { await post(`/api/problems/${id}/actions`,parsed.data); requestId.current=null; setValues({ summary:title.slice(0,200),description:"",location:"",start:"",end:"" }); refresh(); }
    catch(error) { setError(error instanceof Error ? error.message : ui(cs,"Unable to prepare this action.","Akci se nepodařilo připravit.")); }
    finally { setPending(""); }
  }
  async function change(actionId:string,kind:"approve"|"cancel") {
    setPending(actionId); setError("");
    try { await post(`/api/actions/${actionId}/${kind}`,kind==="approve" ? { confirmation:"CREATE" } : {}); if(kind==="approve") trackProductEvent("calendar_action_succeeded", "/problems/:id"); setReviewing(null); refresh(); }
    catch(error) { setError(error instanceof Error ? error.message : ui(cs,"Unable to update this action.","Akci se nepodařilo aktualizovat.")); refresh(); }
    finally { setPending(""); }
  }
  const returnTo=encodeURIComponent(`/problems/${id}?view=tasks`);
  return <Panel title={ui(cs,"External actions","Externí akce")} description={ui(cs,"Avenli prepares a reviewable action first. Nothing is written to Google until you approve the exact event.","Avenli nejprve připraví návrh ke kontrole. Do Google se nic nezapíše, dokud konkrétní událost neschválíte.")}>
    {actions.length>0&&<div className="mb-6 space-y-4">{actions.map((action)=><article key={action.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">{cs ? labelsCs[action.status] : labels[action.status]} · {ui(cs,"Calendar event","Událost kalendáře")}</p><h3 className="mt-1 font-semibold">{action.payload.summary}</h3></div><CalendarPlus className="size-5 text-primary" aria-hidden="true" /></div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">{ui(cs,"Starts","Začátek")}</dt><dd>{new Date(action.payload.start).toLocaleString(cs ? "cs-CZ" : "en-US")}</dd></div><div><dt className="text-xs text-muted-foreground">{ui(cs,"Ends","Konec")}</dt><dd>{new Date(action.payload.end).toLocaleString(cs ? "cs-CZ" : "en-US")}</dd></div>{action.payload.location&&<div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{ui(cs,"Location","Místo")}</dt><dd>{action.payload.location}</dd></div>}</dl>
      {action.payload.description&&<p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{action.payload.description}</p>}
      {action.status==="succeeded"&&action.result&&<a href={action.result.eventUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-primary underline">{ui(cs,"Open created Google event","Otevřít vytvořenou událost Google")}</a>}
      {action.status==="failed"&&<p className="mt-3 text-sm text-destructive">{ui(cs,"The provider attempt failed. Review the unchanged event details before retrying.","Vytvoření se nezdařilo. Před dalším pokusem zkontrolujte nezměněné údaje události.")}</p>}
      {["proposed","failed"].includes(action.status)&&<div className="mt-4 space-y-3 border-t pt-4">
        {!access.calendarWriteAuthorized ? <Link className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={`/auth/integrations/google?service=calendar&access=write&next=${returnTo}`}><ShieldCheck className="mr-2 size-4" />{ui(cs,"Authorize event creation","Povolit vytváření událostí")}</Link> : reviewing===action.id ? <div className="rounded-lg bg-secondary p-4"><p className="text-sm font-medium">{ui(cs,"Create this exact event in your primary Google Calendar now?","Vytvořit právě tuto událost v hlavním Kalendáři Google?")}</p><p className="mt-1 text-xs text-muted-foreground">{ui(cs,"No attendees are added and no invitations are sent.","Nepřidají se účastníci a neodešlou se pozvánky.")}</p><div className="mt-3 flex gap-3"><Button disabled={Boolean(pending)} onClick={()=>void change(action.id,"approve")}>{ui(cs,"Create event now","Vytvořit událost")}</Button><Button variant="outline" disabled={Boolean(pending)} onClick={()=>setReviewing(null)}>{ui(cs,"Back","Zpět")}</Button></div></div> : <Button disabled={Boolean(pending)} onClick={()=>setReviewing(action.id)}>{ui(cs,"Review approval","Zkontrolovat schválení")}</Button>}
        <Button variant="outline" disabled={Boolean(pending)} onClick={()=>void change(action.id,"cancel")}>{ui(cs,"Cancel proposal","Zrušit návrh")}</Button>
      </div>}
    </article>)}</div>}
    {!analysisComplete ? <p className="text-sm text-muted-foreground">{ui(cs,"Complete the analysis before preparing an external action.","Před přípravou externí akce dokončete analýzu.")}</p> : !access.calendarEnabled ? <p className="text-sm text-muted-foreground">{ui(cs,"Connect and enable","Připojte a zapněte")} <Link href="/settings" className="text-primary underline">{ui(cs,"Google Calendar in Settings","Kalendář Google v nastavení")}</Link> {ui(cs,"to prepare an event.","pro přípravu události.")}</p> : <form className="space-y-4" onSubmit={(event)=>{ event.preventDefault();void submit(); }}>
      <label className="block space-y-2 text-sm"><span className="font-medium">{ui(cs,"Event title","Název události")}</span><Input required maxLength={200} value={values.summary} onChange={(event)=>setValues({ ...values,summary:event.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm"><span className="font-medium">{ui(cs,"Start","Začátek")}</span><Input type="datetime-local" required value={values.start} onChange={(event)=>setValues({ ...values,start:event.target.value })} /></label><label className="block space-y-2 text-sm"><span className="font-medium">{ui(cs,"End","Konec")}</span><Input type="datetime-local" required value={values.end} onChange={(event)=>setValues({ ...values,end:event.target.value })} /></label></div>
      <label className="block space-y-2 text-sm"><span className="font-medium">{ui(cs,"Location","Místo")}</span><Input maxLength={500} value={values.location} onChange={(event)=>setValues({ ...values,location:event.target.value })} /></label>
      <label className="block space-y-2 text-sm"><span className="font-medium">{ui(cs,"Description","Popis")}</span><textarea rows={3} maxLength={2000} className="block w-full rounded-lg border bg-background p-3" value={values.description} onChange={(event)=>setValues({ ...values,description:event.target.value })} /></label>
      <p className="text-xs text-muted-foreground">{ui(cs,"Preparing saves a proposal and audit entry only. You will review it again before Google is changed.","Příprava pouze uloží návrh a záznam akce. Před změnou v Google vše znovu zkontrolujete.")}</p>
      <Button disabled={Boolean(pending)}>{pending==="proposal" ? ui(cs,"Preparing…","Připravuji…") : ui(cs,"Prepare calendar event","Připravit událost")}</Button>
    </form>}
    {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </Panel>;
}
