import { calendarWindowSchema } from "@/lib/integrations/contracts";
import { readCalendar } from "@/lib/integrations/google";
import { failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationsEnabled } from "@/lib/integrations/config";

export async function GET(request: Request) {
  try {
    if (!googleIntegrationsEnabled()) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const { user } = await identity();
    const parsed = calendarWindowSchema.safeParse({ days: new URL(request.url).searchParams.get("days") ?? undefined });
    if (!parsed.success) throw new WorkspaceError("INVALID_REQUEST");
    return json({ events: await readCalendar(user.id, parsed.data.days), windowDays: parsed.data.days });
  } catch (error) { return failure(error); }
}
