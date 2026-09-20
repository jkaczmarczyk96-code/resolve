import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { taskUpdateSchema } from "@/lib/workspace/contracts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await identity();
    const { id } = await params;
    const input = taskUpdateSchema.safeParse(await body(request));
    if (!z.uuid().safeParse(id).success || !input.success) throw new WorkspaceError("INVALID_TASK");
    const completedAt = input.data.status === "completed" ? new Date().toISOString() : null;
    const result = await client.from("tasks").update({ status: input.data.status, completed_at: completedAt }).eq("id", input.data.taskId).eq("problem_id", id).not("workflow_run_id", "is", null).select("id,status,completed_at").abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (result.error) throw new WorkspaceError("TASK_UPDATE_FAILED", 503);
    if (!result.data) throw new WorkspaceError("NOT_FOUND", 404);
    return json({ id: result.data.id, status: result.data.status, completedAt: result.data.completed_at });
  } catch (error) { return failure(error); }
}
