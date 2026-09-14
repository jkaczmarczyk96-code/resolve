import { z } from "zod";
import { body,failure,identity,json,WorkspaceError } from "@/lib/workspace/http";

export async function POST(request:Request,{ params }:{ params:Promise<{ id:string }> }) {
  try {
    const { client }=await identity(); const { id }=await params;
    const input=await body(request);
    if (!z.uuid().safeParse(id).success || typeof input!=="object" || input===null || Object.keys(input).length!==0) throw new WorkspaceError("INVALID_ACTION");
    const result=await client.rpc("cancel_external_action",{ p_action_id:id }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw new WorkspaceError(result.error.message.includes("NOT_FOUND") ? "NOT_FOUND" : "SERVICE_UNAVAILABLE",result.error.message.includes("NOT_FOUND") ? 404 : 503);
    if (!result.data) throw new WorkspaceError("INVALID_ACTION_STATE",409);
    return json({ cancelled:true });
  } catch(error) { return failure(error); }
}
