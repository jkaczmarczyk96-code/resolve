import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { taskUpdateSchema } from "@/lib/workspace/contracts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await identity();
    const { id } = await params;
    const input = taskUpdateSchema.safeParse(await body(request));
    if (!z.uuid().safeParse(id).success || !input.success) throw new WorkspaceError("INVALID_TASK");
    if (input.data.dueAt && Date.parse(input.data.dueAt) <= Date.now()) throw new WorkspaceError("INVALID_TASK_DUE_DATE");
    const update: { status?: typeof input.data.status; completed_at?: string | null; due_at?: string | null } = {};
    if (input.data.status !== undefined) { update.status = input.data.status; update.completed_at = input.data.status === "completed" ? new Date().toISOString() : null; }
    if (input.data.dueAt !== undefined) update.due_at = input.data.dueAt;
    const result = await client.from("tasks").update(update).eq("id", input.data.taskId).eq("problem_id", id).not("workflow_run_id", "is", null).select("id,status,completed_at,due_at").abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (result.error) throw new WorkspaceError("TASK_UPDATE_FAILED", 503);
    if (!result.data) throw new WorkspaceError("NOT_FOUND", 404);
    return json({ id: result.data.id, status: result.data.status, completedAt: result.data.completed_at, dueAt: result.data.due_at });
  } catch (error) { return failure(error); }
}
