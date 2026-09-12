import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { monitoringCreateSchema, monitoringUpdateSchema } from "@/lib/workspace/contracts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await identity(); const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new WorkspaceError("NOT_FOUND", 404);
    const input = monitoringCreateSchema.safeParse(await body(request)); if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.rpc("create_monitoring_condition", { p_problem_id: id, p_description: input.data.description, p_search_query: input.data.searchQuery }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw new WorkspaceError(["NOT_FOUND", "NOT_READY"].includes(result.error.message) ? result.error.message : result.error.message === "MONITOR_LIMIT" ? "MONITOR_LIMIT" : "SERVICE_UNAVAILABLE", result.error.message === "NOT_FOUND" ? 404 : result.error.message === "MONITOR_LIMIT" ? 429 : 409);
    return json(result.data, 201);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await identity(); const { id } = await params;
    const input = monitoringUpdateSchema.safeParse(await body(request)); if (!z.uuid().safeParse(id).success || !input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.rpc("set_monitoring_condition_status", { p_condition_id: input.data.conditionId, p_status: input.data.status }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw new WorkspaceError(result.error.message === "NOT_FOUND" ? "NOT_FOUND" : "SERVICE_UNAVAILABLE", result.error.message === "NOT_FOUND" ? 404 : 503);
    return json(result.data);
  } catch (error) { return failure(error); }
}
