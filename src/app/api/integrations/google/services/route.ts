import { googleIntegrationEnabledFor } from "@/lib/integrations/config";
import { googleServiceSettingSchema } from "@/lib/integrations/contracts";
import { setGoogleServiceEnabled } from "@/lib/integrations/google";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";

export async function POST(request: Request) {
  try {
    const { client, user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const parsed = googleServiceSettingSchema.safeParse(await body(request));
    if (!parsed.success) throw new WorkspaceError("INVALID_REQUEST");
    await setGoogleServiceEnabled(client, parsed.data.service, parsed.data.enabled);
    return json({ service: parsed.data.service, enabled: parsed.data.enabled });
  } catch (error) { return failure(error); }
}
