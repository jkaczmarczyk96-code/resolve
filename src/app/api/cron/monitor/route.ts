import { authorizedCron, emitDueTaskNotifications, monitorDueConditions } from "@/lib/monitoring/execution";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!authorizedCron(request.headers.get("authorization"))) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const taskNotifications=await emitDueTaskNotifications();
    return Response.json({ ...(await monitorDueConditions()),taskNotifications });
  }
  catch { return Response.json({ error: "MONITOR_FAILED" }, { status: 503 }); }
}
