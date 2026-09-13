import { calendarWindowSchema } from "@/lib/integrations/contracts";
import { readCalendar } from "@/lib/integrations/google";
import { failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

export async function GET(request: Request) {
  try {
    const { user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) throw new WorkspaceError("INTEGRATION_UNAVAILABLE", 503);
    const parsed = calendarWindowSchema.safeParse({ days: new URL(request.url).searchParams.get("days") ?? undefined });
    if (!parsed.success) throw new WorkspaceError("INVALID_REQUEST");
    return json({ events: await readCalendar(user.id, parsed.data.days), windowDays: parsed.data.days });
  } catch (error) { return failure(error); }
}
