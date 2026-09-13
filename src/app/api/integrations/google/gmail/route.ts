import { gmailSearchSchema } from "@/lib/integrations/contracts";
import { readGmail } from "@/lib/integrations/google";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationsEnabled } from "@/lib/integrations/config";

export async function POST(request: Request) {
  try {
    if (!googleIntegrationsEnabled()) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const { user } = await identity();
    const parsed = gmailSearchSchema.safeParse(await body(request));
    if (!parsed.success) throw new WorkspaceError("INVALID_REQUEST");
    return json({ messages: await readGmail(user.id, parsed.data.query) });
  } catch (error) { return failure(error); }
}
