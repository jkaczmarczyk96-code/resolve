"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { GoogleLogo } from "@/components/google-logo";
import { Panel } from "@/components/demo/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CalendarItem, GmailItem } from "@/lib/integrations/contracts";

export type GoogleConnection = { status: string; account_email: string; scopes: string[]; connected_at: string; last_synced_at: string | null } | null;

async function data<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new Error(value && typeof value === "object" && "error" in value ? value.error : "SERVICE_UNAVAILABLE");
  return value as T;
}

const errorMessage: Record<string, string> = {
  INTEGRATION_NOT_CONNECTED: "Connect Google again before reading your data.",
  INTEGRATION_RECONNECT_REQUIRED: "Google access expired. Reconnect the service.",
  INTEGRATION_PERMISSION_REQUIRED: "The required read-only permission is missing.",
  INTEGRATION_UNAVAILABLE: "The Google service is temporarily unavailable.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Try again later.",
};

export function GoogleIntegrationSettings({ enabled, connection, notice }: { enabled: boolean; connection: GoogleConnection; notice?: string }) {
  const router = useRouter(); const connected = connection?.status === "connected";
  const [pending, setPending] = useState(""); const [message, setMessage] = useState("");
  const [calendarLoaded, setCalendarLoaded] = useState(false); const [gmailLoaded, setGmailLoaded] = useState(false);
  const [gmailQuery, setGmailQuery] = useState(""); const [events, setEvents] = useState<CalendarItem[]>([]); const [messages, setMessages] = useState<GmailItem[]>([]);
  async function run<T>(name: string, work: () => Promise<T>, done: (value: T) => void) {
    if (pending) return; setPending(name); setMessage("");
    try { done(await work()); } catch (error) { const code = error instanceof Error ? error.message : "SERVICE_UNAVAILABLE"; setMessage(errorMessage[code] ?? "Unable to read Google data."); }
    finally { setPending(""); }
  }
  const noticeText = notice === "connected" ? "Google Calendar and Gmail are connected." : notice === "failed" ? "Google connection could not be completed. Try again and approve both read-only permissions." : notice === "unavailable" ? "Google integrations are not configured yet." : "";
  return <Panel title="Connected services" description="Bring relevant schedule and email context into Avenli when you choose to read it.">
    {noticeText && <p role="status" className="mb-4 rounded-lg bg-secondary p-3 text-sm">{noticeText}</p>}
    {!enabled ? <p className="text-sm text-muted-foreground">No external data services are enabled.</p> : !connected ? <div className="space-y-4">
      <div className="rounded-xl border p-4"><div className="flex items-center gap-3"><GoogleLogo className="size-6" /><div><p className="font-medium">Google Calendar + Gmail</p><p className="text-sm text-muted-foreground">Read-only access. Avenli cannot send email, edit events or create events.</p></div></div></div>
      <Button asChild><a href="/auth/integrations/google"><GoogleLogo />Connect Google read-only</a></Button>
    </div> : <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4"><div className="flex gap-3"><GoogleLogo className="mt-0.5 size-6" /><div><p className="font-medium">{connection.account_email}</p><p className="mt-1 text-sm text-muted-foreground">Calendar and Gmail · read-only</p><p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Connected {new Date(connection.connected_at).toLocaleDateString()}</p></div></div><Button variant="outline" disabled={Boolean(pending)} onClick={() => run("disconnect", async () => data<{ remoteRevoked: boolean }>(await fetch("/api/integrations/google/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })), (value) => { setMessage(value.remoteRevoked ? "Google disconnected." : "Disconnected locally. Remove Avenli in your Google Account to revoke remote access."); router.refresh(); })}>Disconnect</Button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border p-4"><div className="flex items-center gap-2 font-medium"><CalendarDays className="size-5 text-primary" />Upcoming calendar</div><p className="text-sm text-muted-foreground">Review busy blocks for the next seven days.</p><Button variant="outline" disabled={Boolean(pending)} onClick={() => run("calendar", async () => (await data<{ events: CalendarItem[] }>(await fetch("/api/integrations/google/calendar?days=7", { cache: "no-store" }))).events, (value) => { setEvents(value); setCalendarLoaded(true); })}>Check availability</Button>{events.length > 0 && <ul className="space-y-2 text-sm">{events.slice(0, 6).map((event) => <li key={event.id} className="rounded-md bg-muted p-2"><span className="font-medium">{event.title}</span><br /><span className="text-muted-foreground">{new Date(event.start).toLocaleString()}</span></li>)}</ul>}{events.length === 0 && calendarLoaded && pending !== "calendar" && <p className="text-sm">No events found.</p>}</div>
        <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); run("gmail", async () => (await data<{ messages: GmailItem[] }>(await fetch("/api/integrations/google/gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: gmailQuery }) }))).messages, (value) => { setMessages(value); setGmailLoaded(true); }); }}><div className="flex items-center gap-2 font-medium"><Mail className="size-5 text-primary" />Relevant email</div><p className="text-sm text-muted-foreground">Search subjects and snippets without loading message bodies.</p><Input required minLength={2} maxLength={200} placeholder="e.g. flight cancellation" value={gmailQuery} onChange={(event) => setGmailQuery(event.target.value)} /><Button variant="outline" disabled={Boolean(pending)}>Search email</Button>{messages.length > 0 && <ul className="space-y-2 text-sm">{messages.map((item) => <li key={item.id} className="rounded-md bg-muted p-2"><span className="font-medium">{item.subject}</span><br /><span className="text-muted-foreground">{item.from}</span><p className="mt-1 line-clamp-2">{item.snippet}</p></li>)}</ul>}{messages.length === 0 && gmailLoaded && pending !== "gmail" && <p className="text-sm">No matching messages found.</p>}</form>
      </div>
    </div>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
  </Panel>;
}
