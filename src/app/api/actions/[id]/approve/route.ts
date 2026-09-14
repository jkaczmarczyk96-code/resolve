import { z } from "zod";
import { actionApprovalSchema } from "@/lib/actions/contracts";
import { executeClaimedAction } from "@/lib/actions/execution";
import { body,failure,identity,json,WorkspaceError } from "@/lib/workspace/http";

function rpcError(message:string) {
  if (message.includes("WRITE_PERMISSION_REQUIRED")) return new WorkspaceError("WRITE_PERMISSION_REQUIRED",409);
  if (message.includes("ACTION_IN_PROGRESS")) return new WorkspaceError("ACTION_IN_PROGRESS",409);
  if (message.includes("INVALID_ACTION_STATE")) return new WorkspaceError("INVALID_ACTION_STATE",409);
  if (message.includes("NOT_FOUND")) return new WorkspaceError("NOT_FOUND",404);
  return new WorkspaceError("SERVICE_UNAVAILABLE",503);
}
export const maxDuration=30;
export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    const { client,user }=await identity(); const { id }=await params;
    const input=actionApprovalSchema.safeParse(await body(request));
    if (!z.uuid().safeParse(id).success || !input.success) throw new WorkspaceError("ACTION_CONFIRMATION_REQUIRED",400);
    const claim=await client.rpc("claim_external_action",{ p_action_id:id }).abortSignal(AbortSignal.timeout(10_000));
    if (claim.error) throw rpcError(claim.error.message);
    return json(await executeClaimedAction(user.id,claim.data));
  } catch(error) { return failure(error); }
}
