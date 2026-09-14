import { NextResponse } from "next/server";
import { identity } from "@/lib/workspace/http";
import { getSiteOrigin } from "@/lib/config/server-env";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { hasSameOrigin } from "@/lib/auth/origin";
import { googleIntegrationEnabledFor, googleIntegrationsEnabled } from "@/lib/integrations/config";
import { googleScopesForServices, googleServicesForScopes } from "@/lib/integrations/google";
import { createGoogleIntegrationState, googleIntegrationStateCookie } from "@/lib/integrations/state";
import { googleServiceSchema, type GoogleService } from "@/lib/integrations/contracts";

export async function GET(request: Request) {
  const origin = getSiteOrigin();
  if (!hasSameOrigin(request, origin)) return new Response("Invalid origin", { status: 403 });
  if (!googleIntegrationsEnabled()) return NextResponse.redirect(`${origin}/settings?integration=unavailable`, 303);
  try {
    const { client, user } = await identity();
    if (!googleIntegrationEnabledFor(user.email)) return NextResponse.redirect(`${origin}/settings?integration=unavailable`, 303);
    const requested = googleServiceSchema.parse(new URL(request.url).searchParams.get("service"));
    const existing = await client.from("integrations").select("status,scopes,enabled_services").eq("user_id",user.id).eq("provider","google").maybeSingle();
    if (existing.error) throw new Error("Integration unavailable");
    const authorized = new Set<GoogleService>(existing.data?.status === "connected" ? googleServicesForScopes(existing.data.scopes) : []);
    const enabled = new Set<GoogleService>(existing.data?.status === "connected" ? existing.data.enabled_services as GoogleService[] : []);
    authorized.add(requested); enabled.add(requested);
    const authorizedServices = [...authorized]; const enabledServices = [...enabled];
    const result = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: googleScopesForServices(authorizedServices).join(" "),
        redirectTo: `${origin}/auth/callback?integration=google&next=%2Fsettings`,
        queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
        skipBrowserRedirect: true,
      },
    });
    if (result.error || !result.data.url) throw new Error("OAuth unavailable");
    const target = new URL(result.data.url);
    if (target.origin !== new URL(getPublicEnvironment().url).origin || target.pathname !== "/auth/v1/authorize") throw new Error("Unexpected OAuth destination");
    const response = NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    response.cookies.set({ name: googleIntegrationStateCookie, value: createGoogleIntegrationState(user.id, authorizedServices, enabledServices), httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/auth/callback", maxAge: 600 });
    return response;
  } catch { return NextResponse.redirect(`${origin}/settings?integration=failed`, 303); }
}
