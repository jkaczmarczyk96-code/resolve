import { revokeAndDisconnect } from "@/lib/integrations/google";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

export async function POST(request: Request) {
  try {
    const { client, user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    await body(request);
    return json({ disconnected: true, remoteRevoked: await revokeAndDisconnect(client, user.id) });
  } catch (error) { return failure(error); }
}
