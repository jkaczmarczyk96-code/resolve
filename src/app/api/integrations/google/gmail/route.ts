import { gmailSearchSchema } from "@/lib/integrations/contracts";
import { readGmail } from "@/lib/integrations/google";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

export async function POST(request: Request) {
  try {
    const { user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const parsed = gmailSearchSchema.safeParse(await body(request));
    if (!parsed.success) throw new WorkspaceError("INVALID_REQUEST");
    return json({ messages: await readGmail(user.id, parsed.data.query) });
  } catch (error) { return failure(error); }
}
