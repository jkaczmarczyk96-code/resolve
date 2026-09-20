"use client";
import { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/demo/primitives";
import { inboxSchema, notificationLabels, type preferencesSchema } from "@/lib/notifications/contracts";
import { patch, post, useRemote } from "./remote";
const noPolling = () => false;
function Preferences({ initial }: { initial: z.infer<typeof preferencesSchema> }) {
  const [value, setValue] = useState(initial); const [pending, setPending] = useState(false); const [message, setMessage] = useState("");
  return <Panel title="Notification preferences" description="Choose which future events appear in your inbox. Existing notifications stay available."><form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault(); setPending(true); setMessage("");
    try { await post("/api/notifications/preferences", value); setMessage("Preferences saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save preferences."); }
    finally { setPending(false); }
  }}>{([{ key: "analysis_updates", label: "Analysis completion and failures" }, { key: "action_required", label: "Requests for your answers" }, { key: "monitoring_updates", label: "Monitoring results and failures" }, { key: "task_updates", label: "Task due date reminders" }] as const).map(({ key, label }) => <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value[key]} disabled={pending} onChange={(event) => setValue({ ...value, [key]: event.target.checked })} />{label}</label>)}<Button disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>{message && <p role="status" className="text-sm">{message}</p>}</form></Panel>;
}
export function NotificationInbox() {
  const { data, error, refresh } = useRemote("/api/notifications", inboxSchema, noPolling);
  const [unreadOnly, setUnreadOnly] = useState(false); const [pending, setPending] = useState<string | null>(null); const [mutationError, setMutationError] = useState("");
  const items = data?.items.filter((item) => !unreadOnly || !item.read_at) ?? [];
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Notifications</h1><Button variant="outline" onClick={refresh}>Refresh notifications</Button></div><p className="text-sm text-muted-foreground">Updates from your analyses, tasks and monitoring. Showing the latest 100 notifications.</p>{(error || mutationError) && <p role="alert">{error || mutationError}</p>}{!data ? <p role="status">{error ? "Unable to load notifications." : "Loading notifications…"}</p> : <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Unread only</label><Panel title="Your updates">{items.length ? <ul className="divide-y">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className={item.read_at ? "text-muted-foreground" : "font-semibold"}>{notificationLabels[item.kind]}{!item.read_at && <span className="ml-2 text-xs text-primary">Unread</span>}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p><Link className="mt-2 inline-block text-sm text-primary underline" href={`/problems/${item.problem_id}${item.kind==="task_due"?"?view=tasks":""}`}>Open problem</Link></div>{!item.read_at && <Button variant="outline" disabled={pending !== null} onClick={async () => {
    setPending(item.id); setMutationError("");
    try { await patch("/api/notifications", { id: item.id }); refresh(); }
    catch (error) { setMutationError(error instanceof Error ? error.message : "Unable to mark as read."); }
    finally { setPending(null); }
  }}>{pending === item.id ? "Saving…" : "Mark as read"}</Button>}</li>)}</ul> : <p className="text-sm text-muted-foreground">{unreadOnly ? "No unread notifications." : "No notifications yet. New updates will appear here."}</p>}</Panel><Preferences initial={data.preferences} /></>}</div>;
}
