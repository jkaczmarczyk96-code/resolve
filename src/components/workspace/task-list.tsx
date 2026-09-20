"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { z } from "zod";
import { tasksOutput } from "@/lib/ai/schemas";
import type { ProblemDetail } from "@/lib/workspace/contracts";
import { cn } from "@/lib/utils";
import { patch } from "./remote";

type GeneratedTask = z.infer<typeof tasksOutput>["tasks"][number];
type TaskStatus = ProblemDetail["tasks"][number]["status"];
const options: { value: TaskStatus; label: string; icon: typeof Circle }[] = [
  { value: "pending", label: "To do", icon: Circle },
  { value: "in_progress", label: "In progress", icon: CircleDashed },
  { value: "completed", label: "Completed", icon: CheckCircle2 },
  { value: "cancelled", label: "Cancelled", icon: XCircle },
];

export function TaskList({ problemId, generated, saved, refresh }: { problemId: string; generated: GeneratedTask[]; saved: ProblemDetail["tasks"]; refresh: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [dueDrafts, setDueDrafts] = useState<Record<string, string>>({});
  const [minimumDue] = useState(() => { const now=new Date(); return new Date(now.getTime()-now.getTimezoneOffset()*60_000).toISOString().slice(0,16); });
  const [error, setError] = useState("");
  if (!generated.length) return <p className="text-sm text-muted-foreground">No tasks were proposed.</p>;

  return <div className="space-y-4">{generated.map((task) => {
    const record = saved.find((item) => item.sourceId === task.id);
    const status = overrides[task.id] ?? record?.status ?? "pending";
    const selected = options.find((item) => item.value === status)!;
    const Icon = selected.icon;
    const savedDue = record?.dueAt ? new Date(new Date(record.dueAt).getTime() - new Date(record.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0,16) : "";
    const dueDraft = dueDrafts[task.id] ?? savedDue;
    return <article key={task.id} className={cn("rounded-xl border p-4 transition-colors", status === "completed" && "border-emerald-200 bg-emerald-50/60", status === "cancelled" && "bg-muted/50 opacity-70")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-xs font-medium text-primary">{task.priority} priority</p><h3 className={cn("mt-2 font-semibold", status === "completed" && "text-emerald-900")}>{task.title}</h3><p className="mt-2 text-sm leading-relaxed">{task.description}</p><p className="mt-3 text-xs text-muted-foreground">Depends on: {task.dependencies.join(", ") || "None"}</p></div>
        <label className="flex shrink-0 items-center gap-2 text-sm"><Icon className="size-4" aria-hidden="true"/><span className="sr-only">Status for {task.title}</span><select aria-label={`Status for ${task.title}`} value={status} disabled={!record || pending === task.id} className="h-10 rounded-md border bg-background px-3" onChange={async (event) => {
          if (!record) return; const next = event.target.value as TaskStatus; setPending(task.id); setError("");
          try { await patch(`/api/problems/${problemId}/tasks`, { taskId: record.id, status: next }); setOverrides((current) => ({ ...current, [task.id]: next })); refresh(); }
          catch (error) { setError(error instanceof Error ? error.message : "Unable to update this task."); }
          finally { setPending(null); }
        }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {record && <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"><label className="min-w-56 flex-1 text-xs font-medium text-muted-foreground"><span className="mb-1 flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden="true"/>Due date</span><input aria-label={`Due date for ${task.title}`} type="datetime-local" value={dueDraft} min={minimumDue} disabled={pending===task.id || status==="completed" || status==="cancelled"} onChange={(event)=>setDueDrafts((current)=>({...current,[task.id]:event.target.value}))} className="h-10 w-full rounded-md border bg-background px-3 text-sm"/></label><Button type="button" variant="outline" disabled={pending===task.id || dueDraft===savedDue || status==="completed" || status==="cancelled"} onClick={async()=>{
        setPending(task.id); setError("");
        try { await patch(`/api/problems/${problemId}/tasks`,{ taskId:record.id,dueAt:dueDraft ? new Date(dueDraft).toISOString() : null }); refresh(); }
        catch(error){ setError(error instanceof Error ? error.message : "Unable to save this due date."); }
        finally { setPending(null); }
      }}>{pending===task.id ? "Saving…" : "Save due date"}</Button>{record.dueAt && <Button type="button" variant="ghost" disabled={pending===task.id} onClick={async()=>{
        setPending(task.id); setError("");
        try { await patch(`/api/problems/${problemId}/tasks`,{ taskId:record.id,dueAt:null }); setDueDrafts((current)=>({...current,[task.id]:""})); refresh(); }
        catch(error){ setError(error instanceof Error ? error.message : "Unable to clear this due date."); }
        finally { setPending(null); }
      }}>Clear</Button>}</div>}
    </article>;
  })}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
