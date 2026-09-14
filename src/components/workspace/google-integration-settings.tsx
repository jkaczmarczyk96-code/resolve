"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { GoogleLogo } from "@/components/google-logo";
import { Panel } from "@/components/demo/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CalendarItem, GmailItem, GoogleService } from "@/lib/integrations/contracts";

export type GoogleConnection = {
  status: string;
  account_email: string;
  scopes: string[];
  enabled_services: string[];
  connected_at: string;
  last_synced_at: string | null;
} | null;

const scopes: Record<GoogleService, string> = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
};
const calendarWriteScope = "https://www.googleapis.com/auth/calendar.events.owned";

async function data<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) throw new Error(value && typeof value === "object" && "error" in value ? value.error : "SERVICE_UNAVAILABLE");
  return value as T;
}

const errorMessage: Record<string, string> = {
  INTEGRATION_NOT_CONNECTED: "Connect Google again before reading your data.",
  INTEGRATION_RECONNECT_REQUIRED: "Google access expired. Reconnect the service.",
  INTEGRATION_PERMISSION_REQUIRED: "Authorize this read-only service before enabling it.",
  INTEGRATION_SERVICE_DISABLED: "Enable this service before reading its data.",
  INTEGRATION_UNAVAILABLE: "The Google service is temporarily unavailable.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Try again later.",
};

function ServiceCard({ title, description, icon, status, action, children }: { title: string; description: string; icon: ReactNode; status: string; action: ReactNode; children?: ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">{icon}<div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{status}</span>
      </div>
      {action}
      {children}
    </div>
  );
}

export function GoogleIntegrationSettings({ enabled, connection, notice }: { enabled: boolean; connection: GoogleConnection; notice?: string }) {
  const router = useRouter(); const connected = connection?.status === "connected";
  const [pending, setPending] = useState(""); const [message, setMessage] = useState("");
  const [calendarLoaded, setCalendarLoaded] = useState(false); const [gmailLoaded, setGmailLoaded] = useState(false);
  const [gmailQuery, setGmailQuery] = useState(""); const [events, setEvents] = useState<CalendarItem[]>([]); const [messages, setMessages] = useState<GmailItem[]>([]);
  const authorized = (service: GoogleService) => Boolean(connected && connection.scopes.includes(scopes[service]));
  const active = (service: GoogleService) => Boolean(connected && connection.enabled_services.includes(service));
  const calendarWriteAuthorized = Boolean(connected && connection.scopes.includes(calendarWriteScope));

  async function run<T>(name: string, work: () => Promise<T>, done: (value: T) => void) {
    if (pending) return; setPending(name); setMessage("");
    try { done(await work()); } catch (error) { const code = error instanceof Error ? error.message : "SERVICE_UNAVAILABLE"; setMessage(errorMessage[code] ?? "Unable to update the Google service."); }
    finally { setPending(""); }
  }

  function serviceAction(service: GoogleService) {
    if (!authorized(service)) return <Button asChild><a href={`/auth/integrations/google?service=${service}`}><GoogleLogo />Connect read-only</a></Button>;
    const next = !active(service);
    return <Button variant="outline" disabled={Boolean(pending)} onClick={() => run(`${service}-setting`, async () => data<{ enabled: boolean }>(await fetch("/api/integrations/google/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service, enabled: next }) })), () => { setMessage(`${service === "calendar" ? "Calendar" : "Gmail"} ${next ? "enabled" : "disabled"}.`); router.refresh(); })}>{next ? "Enable" : "Disable"}</Button>;
  }

  const noticeText = notice === "connected" ? "The selected Google service is connected." : notice === "failed" ? "Google connection could not be completed. Try again and approve the selected read-only permission." : notice === "unavailable" ? "Google integrations are not available for this account yet." : "";

  return <Panel title="Connected services" description="Choose which external services Avenli may use. Every service is optional and can be disabled independently.">
    {noticeText && <p role="status" className="mb-4 rounded-lg bg-secondary p-3 text-sm">{noticeText}</p>}
    {!enabled ? <p className="text-sm text-muted-foreground">No external data services are available for this account.</p> : <div className="space-y-6">
      {connected && <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4">
        <div className="flex gap-3"><GoogleLogo className="mt-0.5 size-6" /><div><p className="font-medium">{connection.account_email}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Google connected {new Date(connection.connected_at).toLocaleDateString()}</p></div></div>
        <Button variant="outline" disabled={Boolean(pending)} onClick={() => run("disconnect", async () => data<{ remoteRevoked: boolean }>(await fetch("/api/integrations/google/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })), (value) => { setMessage(value.remoteRevoked ? "Google disconnected." : "Disconnected locally. Remove Avenli in your Google Account to revoke remote access."); router.refresh(); })}>Disconnect Google</Button>
      </div>}
      <div className="grid gap-4 md:grid-cols-2">
        <ServiceCard title="Google Calendar" description="Read upcoming availability and create only the exact events you approve." icon={<CalendarDays className="mt-0.5 size-5 text-primary" />} status={active("calendar") ? "Enabled" : authorized("calendar") ? "Off" : "Not connected"} action={serviceAction("calendar")}>
          {authorized("calendar") && <p className="text-xs text-muted-foreground">Event creation permission: {calendarWriteAuthorized ? "authorized" : "requested only when you approve a prepared action"}.</p>}
          {active("calendar") && <div className="space-y-3 border-t pt-4"><Button variant="outline" disabled={Boolean(pending)} onClick={() => run("calendar", async () => (await data<{ events: CalendarItem[] }>(await fetch("/api/integrations/google/calendar?days=7", { cache: "no-store" }))).events, (value) => { setEvents(value); setCalendarLoaded(true); })}>Check next 7 days</Button>{events.length > 0 && <ul className="space-y-2 text-sm">{events.slice(0, 6).map((event) => <li key={event.id} className="rounded-md bg-muted p-2"><span className="font-medium">{event.title}</span><br /><span className="text-muted-foreground">{new Date(event.start).toLocaleString()}</span></li>)}</ul>}{events.length === 0 && calendarLoaded && pending !== "calendar" && <p className="text-sm">No events found.</p>}</div>}
        </ServiceCard>
        <ServiceCard title="Gmail" description="Search message headers and short snippets. Avenli cannot send email." icon={<Mail className="mt-0.5 size-5 text-primary" />} status={active("gmail") ? "Enabled" : authorized("gmail") ? "Off" : "Not connected"} action={serviceAction("gmail")}>
          {active("gmail") && <form className="space-y-3 border-t pt-4" onSubmit={(event) => { event.preventDefault(); run("gmail", async () => (await data<{ messages: GmailItem[] }>(await fetch("/api/integrations/google/gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: gmailQuery }) }))).messages, (value) => { setMessages(value); setGmailLoaded(true); }); }}><Input required minLength={2} maxLength={200} placeholder="e.g. flight cancellation" value={gmailQuery} onChange={(event) => setGmailQuery(event.target.value)} /><Button variant="outline" disabled={Boolean(pending)}>Search email</Button>{messages.length > 0 && <ul className="space-y-2 text-sm">{messages.map((item) => <li key={item.id} className="rounded-md bg-muted p-2"><span className="font-medium">{item.subject}</span><br /><span className="text-muted-foreground">{item.from}</span><p className="mt-1 line-clamp-2">{item.snippet}</p></li>)}</ul>}{messages.length === 0 && gmailLoaded && pending !== "gmail" && <p className="text-sm">No matching messages found.</p>}</form>}
        </ServiceCard>
      </div>
      <p className="text-xs text-muted-foreground">Additional services can be added here with their own permission and disconnect control.</p>
    </div>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
  </Panel>;
}
