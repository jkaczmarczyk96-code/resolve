import { z } from "zod";
import { actionProposalSchema } from "@/lib/actions/contracts";
import { body,failure,identity,json,WorkspaceError } from "@/lib/workspace/http";

function rpcError(message:string) {
  if (message.includes("NOT_READY")) return new WorkspaceError("NOT_READY",409);
  if (message.includes("INTEGRATION_NOT_CONNECTED")) return new WorkspaceError("INTEGRATION_NOT_CONNECTED",409);
  if (message.includes("ACTION_LIMIT")) return new WorkspaceError("ACTION_LIMIT",429);
  if (message.includes("REQUEST_CONFLICT")) return new WorkspaceError("CONFLICT",409);
  if (message.includes("INVALID_ACTION")) return new WorkspaceError("INVALID_ACTION",400);
  return new WorkspaceError("SERVICE_UNAVAILABLE",503);
}

export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    const { client }=await identity(); const { id }=await params;
    const input=actionProposalSchema.safeParse(await body(request));
    if (!z.uuid().safeParse(id).success || !input.success || Date.parse(input.data.payload.start)<Date.now()-300_000) throw new WorkspaceError("INVALID_ACTION");
    const result=await client.rpc("propose_calendar_action",{ p_problem_id:id,p_request_id:input.data.requestId,p_payload:input.data.payload }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw rpcError(result.error.message);
    return json({ id:result.data },201);
  } catch(error) { return failure(error); }
}
