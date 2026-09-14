import "server-only";
import { createCalendarEvent } from "@/lib/integrations/google";
import { serviceRpc } from "@/lib/supabase/service-rpc";
import { WorkspaceError } from "@/lib/workspace/http";
import { actionExecutionResultSchema,calendarActionResultSchema,claimedActionSchema } from "./contracts";

export async function executeClaimedAction(userId:string,value:unknown) {
  const action=claimedActionSchema.parse(value);
  if (action.alreadyCompleted) return actionExecutionResultSchema.parse({ id:action.id,status:action.status,result:action.result,error:null });
  try {
    const result=calendarActionResultSchema.parse(await createCalendarEvent(userId,action.id,action.payload));
    return actionExecutionResultSchema.parse(await serviceRpc<unknown>("finish_external_action",{ p_user:userId,p_action_id:action.id,p_success:true,p_result:result,p_error:null }));
  } catch (error) {
    const code=error instanceof WorkspaceError ? error.code : "ACTION_PROVIDER_FAILED";
    try { await serviceRpc<unknown>("finish_external_action",{ p_user:userId,p_action_id:action.id,p_success:false,p_result:null,p_error:code }); } catch { /* Keep the provider error as the public result. */ }
    throw error instanceof WorkspaceError ? error : new WorkspaceError("ACTION_PROVIDER_FAILED",502);
  }
}
