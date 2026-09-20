import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { defaultPreferences, readSchema } from "@/lib/notifications/contracts";

export async function GET() {
  try {
    const { client, user } = await identity();
    const [items, preferences] = await Promise.all([
      client.from("notifications").select("id,problem_id,kind,created_at,read_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").limit(100).abortSignal(AbortSignal.timeout(10_000)),
      client.from("notification_preferences").select("analysis_updates,action_required,monitoring_updates,task_updates").eq("user_id", user.id).abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
    ]);
    if (items.error || preferences.error) throw new WorkspaceError("LOAD_FAILED", 503);
    return json({ items: items.data, preferences: preferences.data ?? defaultPreferences });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    const { client } = await identity(); const input = readSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.rpc("read_notification", { p_id: input.data.id }).abortSignal(AbortSignal.timeout(10_000));
    if (result.error) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    if (!result.data) throw new WorkspaceError("NOT_FOUND", 404);
    return json({ saved: true });
  } catch (error) { return failure(error); }
}
