"use client";
import { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { inboxSchema, notificationLabels, type preferencesSchema } from "@/lib/notifications/contracts";
import { patch, post, useRemote } from "./remote";
import { LoadingSkeleton } from "./loading-skeleton";
import { ui, useCzech } from "./ui-language";
const noPolling = () => false;
const czechNotificationLabels: Record<keyof typeof notificationLabels,string> = { analysis_completed:"Analýza je připravena k posouzení", analysis_failed:"Analýzu je potřeba opakovat", input_required:"Avenli potřebuje vaše odpovědi", condition_met:"Sledovaná podmínka se splnila", monitor_failed:"Sledování vyžaduje pozornost", task_due:"Úkol má termín do 24 hodin" };
function Preferences({ initial }: { initial: z.infer<typeof preferencesSchema> }) {
  const cs = useCzech();
  const [value, setValue] = useState(initial); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <Panel title={ui(cs,"Notification preferences","Nastavení upozornění")} description={ui(cs,"Choose which future events appear in your inbox.","Zvolte, které nové události chcete dostávat.")}><form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage("");
    try { await post("/api/notifications/preferences", value); setMessage(ui(cs,"Preferences saved.","Nastavení bylo uloženo.")); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save preferences."); }
    finally { setPending(false); }
  }}>{([{ key: "analysis_updates", label: ui(cs,"Analysis completion and failures","Dokončení a chyby analýzy") }, { key: "action_required", label: ui(cs,"Requests for your answers","Žádosti o vaše odpovědi") }, { key: "monitoring_updates", label: ui(cs,"Monitoring results and failures","Výsledky a chyby sledování") }, { key: "task_updates", label: ui(cs,"Task due date reminders","Připomenutí termínů úkolů") }] as const).map(({ key, label }) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value[key]} disabled={pending} onChange={(event) => setValue({ ...value, [key]: event.target.checked })} />{label}</label>)}<Button disabled={pending}>{pending ? ui(cs,"Saving…","Ukládám…") : ui(cs,"Save preferences","Uložit nastavení")}</Button>{message && <p role="status" className="text-sm">{message}</p>}</form></Panel>;
}
export function NotificationInbox() {
  const cs = useCzech();
  const { data, error, refresh } = useRemote("/api/notifications", inboxSchema, noPolling);
  const [unreadOnly, setUnreadOnly] = useState(false); const [pending, setPending] = useState<string | null>(null); const [mutationError, setMutationError] = useState("");
  const items = data?.items.filter((item) => !unreadOnly || !item.read_at) ?? [];
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><PageHeading eyebrow={ui(cs,"Inbox","Doručená pošta")} title={ui(cs,"Notifications","Upozornění")} description={ui(cs,"Updates from your analyses, tasks and monitoring.","Novinky k analýzám, úkolům a sledování.")} /><Button variant="outline" onClick={refresh}>{ui(cs,"Refresh notifications","Obnovit upozornění")}</Button></div>{(error || mutationError) && <p role="alert">{error || mutationError}</p>}{!data ? (error ? <p role="alert">{ui(cs,"Unable to load notifications.","Upozornění se nepodařilo načíst.")}</p> : <LoadingSkeleton />) : <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />{ui(cs,"Unread only","Jen nepřečtené")}</label><Panel title={ui(cs,"Your updates","Vaše novinky")}>{items.length ? <ul className="divide-y">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className={item.read_at ? "text-muted-foreground" : "font-semibold"}>{cs ? czechNotificationLabels[item.kind] : notificationLabels[item.kind]}{!item.read_at && <span className="ml-2 text-xs text-primary">{ui(cs,"Unread","Nepřečtené")}</span>}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString(cs ? "cs-CZ" : "en-US")}</p><Link className="mt-2 inline-block text-sm text-primary underline" href={`/problems/${item.problem_id}${item.kind==="task_due"?"?view=tasks":""}`}>{ui(cs,"Open problem","Otevřít zadání")}</Link></div>{!item.read_at && <Button variant="outline" disabled={pending !== null} onClick={async () => {
    setPending(item.id); setMutationError("");
    try { await patch("/api/notifications", { id: item.id }); refresh(); }
    catch (error) { setMutationError(error instanceof Error ? error.message : "Unable to mark as read."); }
    finally { setPending(null); }
  }}>{pending === item.id ? ui(cs,"Saving…","Ukládám…") : ui(cs,"Mark as read","Označit jako přečtené")}</Button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">{unreadOnly ? ui(cs,"No unread notifications.","Žádná nepřečtená upozornění.") : ui(cs,"No notifications yet. New updates will appear here.","Zatím nemáte upozornění.")}</p>}</Panel><Preferences initial={data.preferences} /></>}</div>;
}
