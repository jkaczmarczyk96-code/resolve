import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { preferencesSchema } from "@/lib/notifications/contracts";
export async function POST(request: Request) {
  try {
    const { client } = await identity(); const input = preferencesSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.rpc("save_notification_preferences", { p_analysis: input.data.analysis_updates, p_action: input.data.action_required, p_monitoring: input.data.monitoring_updates, p_tasks: input.data.task_updates }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    return json({ saved: true });
  } catch (error) { return failure(error); }
}
