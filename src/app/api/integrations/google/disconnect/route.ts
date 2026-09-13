import { revokeAndDisconnect } from "@/lib/integrations/google";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationsEnabled } from "@/lib/integrations/config";

export async function POST(request: Request) {
  try {
    if (!googleIntegrationsEnabled()) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const { client, user } = await identity();
    await body(request);
    return json({ disconnected: true, remoteRevoked: await revokeAndDisconnect(client, user.id) });
  } catch (error) { return failure(error); }
}
