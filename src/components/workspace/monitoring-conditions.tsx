"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/demo/primitives";
import { monitoringCreateSchema, type ProblemDetail } from "@/lib/workspace/contracts";
import { patch, post } from "./remote";

const statusLabel = { active: "Watching", checking: "Checking now", met: "Condition met", paused: "Paused", failed: "Check failed" } as const;

export function MonitoringConditions({ id, conditions, enabled, problemSolved, refresh }: { id: string; conditions: ProblemDetail["conditions"]; enabled: boolean; problemSolved: boolean; refresh: () => void }) {
  const [description, setDescription] = useState(""); const [searchQuery, setSearchQuery] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function setStatus(conditionId: string, status: "active" | "paused") {
    setPending(true); setError("");
    try { await patch(`/api/problems/${id}/monitor`, { conditionId, status }); refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to update this condition."); }
    finally { setPending(false); }
  }
  return <Panel title="Monitoring conditions" description="Avenli checks active conditions once a day and brings the problem back for review when current evidence shows that a condition was met.">
    {conditions.length > 0 && <div className="mb-6 space-y-4">{conditions.map((condition) => <article key={condition.id} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">{statusLabel[condition.status]}</p><h3 className="mt-1 font-semibold">{condition.description}</h3></div>{["active", "paused", "failed"].includes(condition.status) && <Button variant="outline" disabled={pending || (problemSolved && condition.status !== "active")} onClick={() => void setStatus(condition.id, condition.status === "active" ? "paused" : "active")}>{condition.status === "active" ? "Pause" : "Resume"}</Button>}</div>
      <p className="mt-3 text-xs text-muted-foreground">Search: {condition.searchQuery}</p>
      {condition.lastResult && <div className="mt-4"><p className="text-sm leading-relaxed">{condition.lastResult.summary}</p>{condition.lastResult.evidence.length > 0 && <div className="mt-3 flex flex-wrap gap-3">{condition.lastResult.evidence.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{source.title}</a>)}</div>}</div>}
      {condition.lastError && <p className="mt-3 text-sm text-destructive">The latest check failed. Resume to try again.</p>}
      <p className="mt-3 text-xs text-muted-foreground">{condition.lastCheckedAt ? `Last checked ${new Date(condition.lastCheckedAt).toLocaleString()}` : `Next check after ${new Date(condition.nextCheckAt).toLocaleString()}`}</p>
    </article>)}</div>}
    {problemSolved && <p className="mb-4 text-sm text-muted-foreground">Reopen this problem before resuming or adding monitoring.</p>}{enabled ? <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); const value = monitoringCreateSchema.safeParse({ description, searchQuery });
      if (!value.success) { setError("Describe the condition and provide a specific search query using at least 10 characters each."); return; }
      setPending(true); setError("");
      try { await post(`/api/problems/${id}/monitor`, value.data); setDescription(""); setSearchQuery(""); refresh(); }
      catch (error) { setError(error instanceof Error ? error.message : "Unable to save this condition."); }
      finally { setPending(false); }
    }}><label className="block space-y-2 text-sm"><span className="font-medium">Condition to watch</span><textarea disabled={pending} required value={description} maxLength={1000} rows={3} className="block w-full rounded-lg border bg-background p-3" placeholder="For example: A nonstop return flight is available for €500 or less." onChange={(event) => setDescription(event.target.value)} /></label><label className="block space-y-2 text-sm"><span className="font-medium">Daily search query</span><Input disabled={pending} required value={searchQuery} maxLength={500} placeholder="nonstop return flight Prague Lisbon October price" onChange={(event) => setSearchQuery(event.target.value)} /></label><p className="text-xs leading-relaxed text-muted-foreground">Checks use Tavily search and Nebius evaluation. Avenli saves cited evidence but does not buy, book, send, or change anything. Relevant results appear in your in-app updates.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending}>{pending ? "Saving…" : "Start monitoring"}</Button></form> : <p className="text-sm text-muted-foreground">Complete this analysis before adding a monitoring condition.</p>}
  </Panel>;
}
