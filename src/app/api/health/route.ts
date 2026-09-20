import { getPublicEnvironment } from "@/lib/config/public-env";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const { url, publishableKey } = getPublicEnvironment();
    const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error("dependency unavailable");
    return Response.json({ status: "ok", service: "avenli", checkedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", service: "avenli", checkedAt }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
