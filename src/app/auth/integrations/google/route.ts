import { NextResponse } from "next/server";
import { identity } from "@/lib/workspace/http";
import { getSiteOrigin } from "@/lib/config/server-env";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { hasSameOrigin } from "@/lib/auth/origin";
import { googleIntegrationEnabledFor, googleIntegrationsEnabled } from "@/lib/integrations/config";
import { GOOGLE_READ_SCOPES } from "@/lib/integrations/google";
import { createGoogleIntegrationState, googleIntegrationStateCookie } from "@/lib/integrations/state";

export async function GET(request: Request) {
  const origin = getSiteOrigin();
  if (!hasSameOrigin(request, origin)) return new Response("Invalid origin", { status: 403 });
  if (!googleIntegrationsEnabled()) return NextResponse.redirect(`${origin}/settings?integration=unavailable`, 303);
  try {
    const { client, user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) return NextResponse.redirect(`${origin}/settings?integration=unavailable`, 303);
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GOOGLE_READ_SCOPES.join(" "),
        redirectTo: `${origin}/auth/callback?integration=google&next=%2Fsettings`,
        queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
        skipBrowserRedirect: true,
      },
    });
    if (result.error || !result.data.url) throw new Error("OAuth unavailable");
    const target = new URL(result.data.url);
    if (target.origin !== new URL(getPublicEnvironment().url).origin || target.pathname !== "/auth/v1/authorize") throw new Error("Unexpected OAuth destination");
    const response = NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    response.cookies.set({ name: googleIntegrationStateCookie, value: createGoogleIntegrationState(user.id), httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/auth/callback", maxAge: 600 });
    return response;
  } catch { return NextResponse.redirect(`${origin}/settings?integration=failed`, 303); }
}
