"use client";

import { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { ArrowUpRight, Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/demo/primitives";
import { inboxSchema, notificationLabels, type preferencesSchema } from "@/lib/notifications/contracts";
import { patch, post, useRemote } from "./remote";
import { LoadingSkeleton } from "./loading-skeleton";
import { ui, useCzech } from "./ui-language";

const noPolling = () => false;
const czechNotificationLabels: Record<keyof typeof notificationLabels, string> = {
  analysis_completed: "Analýza je připravena k posouzení",
  analysis_failed: "Analýzu je potřeba opakovat",
  input_required: "Avenli potřebuje vaše odpovědi",
  condition_met: "Sledovaná podmínka se splnila",
  monitor_failed: "Sledování vyžaduje pozornost",
  task_due: "Úkol má termín do 24 hodin",
};

function Preferences({ initial }: { initial: z.infer<typeof preferencesSchema> }) {
  const cs = useCzech();
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const choices = [
    { key: "analysis_updates", label: ui(cs, "Analysis completion and failures", "Dokončení a chyby analýzy") },
    { key: "action_required", label: ui(cs, "Requests for your answers", "Žádosti o vaše odpovědi") },
    { key: "monitoring_updates", label: ui(cs, "Monitoring results and failures", "Výsledky a chyby sledování") },
    { key: "task_updates", label: ui(cs, "Task due date reminders", "Připomenutí termínů úkolů") },
  ] as const;
  return <Panel title={ui(cs, "Notification preferences", "Nastavení upozornění")} description={ui(cs, "Choose which future events appear in your inbox.", "Zvolte, které nové události chcete dostávat.")}>
    <form className="space-y-3" onSubmit={async (event) => {
      event.preventDefault(); setPending(true); setMessage("");
      try { await post("/api/notifications/preferences", value); setMessage(ui(cs, "Preferences saved.", "Nastavení bylo uloženo.")); }
      catch (error) { setMessage(error instanceof Error ? error.message : ui(cs, "Unable to save preferences.", "Nastavení se nepodařilo uložit.")); }
      finally { setPending(false); }
    }}>
      {choices.map(({ key, label }) => <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 text-sm transition hover:border-border hover:bg-[#f8f9ff]"><span>{label}</span><input className="size-4 shrink-0 accent-primary" type="checkbox" checked={value[key]} disabled={pending} onChange={(event) => setValue({ ...value, [key]: event.target.checked })} /></label>)}
      <Button size="sm" disabled={pending}>{pending ? ui(cs, "Saving…", "Ukládám…") : ui(cs, "Save preferences", "Uložit nastavení")}</Button>
      {message && <p role="status" className="text-xs">{message}</p>}
    </form>
  </Panel>;
}

export function NotificationInbox() {
  const cs = useCzech();
  const { data, error, refresh } = useRemote("/api/notifications", inboxSchema, noPolling);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState("");
  const items = data?.items.filter((item) => !unreadOnly || !item.read_at) ?? [];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><PageHeading eyebrow={ui(cs, "Inbox", "Doručená pošta")} title={ui(cs, "Notifications", "Upozornění")} description={ui(cs, "Updates from your analyses, tasks and monitoring.", "Novinky k analýzám, úkolům a sledování.")} /><Button size="sm" variant="outline" onClick={refresh}>{ui(cs, "Refresh", "Obnovit")}</Button></div>
    {(mutationError || (data && error)) && <p role="alert" className="text-sm text-destructive">{mutationError || error}</p>}
    {!data ? (error ? <Panel title={ui(cs, "Unable to load notifications", "Upozornění se nepodařilo načíst")}><p role="alert" className="text-sm text-muted-foreground">{error}</p><Button className="mt-3" size="sm" variant="outline" onClick={refresh}>{ui(cs, "Try again", "Zkusit znovu")}</Button></Panel> : <LoadingSkeleton />) : <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]">
      <section className="avenli-panel overflow-hidden rounded-2xl" aria-label={ui(cs, "Your updates", "Vaše novinky")}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"><div className="flex items-center gap-2"><Bell className="size-4 text-primary" aria-hidden="true" /><h2 className="text-sm font-semibold">{ui(cs, "Your updates", "Vaše novinky")}</h2><span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">{data.items.filter((item) => !item.read_at).length}</span></div><label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input className="size-4 accent-primary" type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />{ui(cs, "Unread only", "Jen nepřečtené")}</label></div>
        {items.length ? <ul className="divide-y">{items.map((item) => <li key={item.id} className="flex flex-col gap-2.5 px-4 py-3.5 transition hover:bg-[#f8f9ff] sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="min-w-0 flex-1"><p className={item.read_at ? "text-sm text-muted-foreground" : "text-sm font-semibold"}>{cs ? czechNotificationLabels[item.kind] : notificationLabels[item.kind]}{!item.read_at && <span className="ml-2 inline-block size-1.5 rounded-full bg-primary" aria-label={ui(cs, "Unread", "Nepřečtené")} />}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString(cs ? "cs-CZ" : "en-US")}</p></div><div className="flex items-center justify-between gap-2 sm:justify-end"><Link className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline" href={`/problems/${item.problem_id}${item.kind === "task_due" ? "?view=tasks" : ""}`}>{ui(cs, "Open problem", "Otevřít zadání")}<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>{!item.read_at && <Button size="sm" variant="ghost" disabled={pending !== null} onClick={async () => {
          setPending(item.id); setMutationError("");
          try { await patch("/api/notifications", { id: item.id }); refresh(); }
          catch (error) { setMutationError(error instanceof Error ? error.message : ui(cs, "Unable to mark as read.", "Upozornění se nepodařilo označit jako přečtené.")); }
          finally { setPending(null); }
        }}><Check className="size-4" aria-hidden="true" />{pending === item.id ? ui(cs, "Saving…", "Ukládám…") : ui(cs, "Mark as read", "Přečteno")}</Button>}</div></li>)}</ul> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">{unreadOnly ? ui(cs, "No unread notifications.", "Žádná nepřečtená upozornění.") : ui(cs, "No notifications yet. New updates will appear here.", "Zatím nemáte upozornění.")}</p>}
      </section>
      <Preferences initial={data.preferences} />
    </div>}
  </div>;
}
