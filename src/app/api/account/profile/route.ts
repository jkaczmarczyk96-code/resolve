import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { profileSchema } from "@/lib/account/contracts";
export async function POST(request: Request) {
  try {
    const { client, user } = await identity(); const input = profileSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_PROFILE");
    const result = await client.from("profiles").update({ ...input.data, display_name: input.data.display_name || null, avatar_url: input.data.avatar_url || null }).eq("id", user.id).select("id").abortSignal(AbortSignal.timeout(10_000)).single();
    if (result.error) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    return json({ saved: true });
  } catch (error) { return failure(error); }
}
