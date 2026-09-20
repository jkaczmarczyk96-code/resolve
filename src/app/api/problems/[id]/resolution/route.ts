import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { resolutionResultSchema, resolutionUpdateSchema } from "@/lib/workspace/contracts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await identity();
    const { id } = await params;
    const input = resolutionUpdateSchema.safeParse(await body(request));
    if (!z.uuid().safeParse(id).success || !input.success) throw new WorkspaceError("INVALID_RESOLUTION");
    const result = await client.rpc("set_problem_resolution", { p_problem_id: id, p_solved: input.data.solved }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) {
      const code = ["NOT_FOUND", "NOT_READY"].includes(result.error.message) ? result.error.message : "RESOLUTION_UPDATE_FAILED";
      throw new WorkspaceError(code, code === "NOT_FOUND" ? 404 : code === "RESOLUTION_UPDATE_FAILED" ? 503 : 409);
    }
    return json(resolutionResultSchema.parse(result.data));
  } catch (error) { return failure(error); }
}

