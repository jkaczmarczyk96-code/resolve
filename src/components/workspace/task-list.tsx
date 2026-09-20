"use client";

import { useState } from "react";
import { CheckCircle2, Circle, CircleDashed, XCircle } from "lucide-react";
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
  const [error, setError] = useState("");
  if (!generated.length) return <p className="text-sm text-muted-foreground">No tasks were proposed.</p>;

  return <div className="space-y-4">{generated.map((task) => {
    const record = saved.find((item) => item.sourceId === task.id);
    const status = overrides[task.id] ?? record?.status ?? "pending";
    const selected = options.find((item) => item.value === status)!;
    const Icon = selected.icon;
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
    </article>;
  })}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}

