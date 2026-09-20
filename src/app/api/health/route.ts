import { getPublicEnvironment } from "@/lib/config/public-env";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    const { url, publishableKey } = getPublicEnvironment();
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error("dependency unavailable");
    return Response.json({ status: "ok", service: "avenli", checkedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", service: "avenli", checkedAt }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
