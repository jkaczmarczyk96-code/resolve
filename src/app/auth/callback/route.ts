import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/config/server-env";
import { safeReturnTo } from "@/lib/auth/routes";
import { clearRecoveryToken, storeRecoveryToken } from "@/lib/auth/recovery";
import { recoveryTokenSchema } from "@/lib/auth/schemas";
import { completeGoogleIntegration } from "@/lib/integrations/google";
import { googleIntegrationStateCookie, readGoogleIntegrationState } from "@/lib/integrations/state";
import { googleIntegrationEnabledFor } from "@/lib/integrations/config";

export async function GET(request: NextRequest) {
  let origin: string;
  try { origin = getSiteOrigin(); } catch {
    return new NextResponse("Account service is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  function go(path: string, clearIntegrationState = false) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    if (clearIntegrationState) response.cookies.set({ name: googleIntegrationStateCookie, value: "", httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/auth/callback", maxAge: 0 });
    return response;
  }
  const token = recoveryTokenSchema.safeParse(request.nextUrl.searchParams.get("token_hash"));
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const googleIntegration = request.nextUrl.searchParams.get("integration") === "google";
  if (googleIntegration && request.nextUrl.searchParams.has("error")) return go("/settings?integration=failed", true);
  if (code && code.length <= 2048 && !request.nextUrl.searchParams.has("token_hash") && !type) {
    try {
      const client = await createClient({ writable: true });
      const result = await client.auth.exchangeCodeForSession(code);
      if (result.error || !result.data.user || !result.data.session) return googleIntegration ? go("/settings?integration=failed", true) : go("/login?error=oauth-failed");
      await clearRecoveryToken();
      if (googleIntegration) {
        if (!googleIntegrationEnabledFor(result.data.user.email)) return go("/settings?integration=unavailable", true);
        const integrationState = readGoogleIntegrationState(request.cookies.get(googleIntegrationStateCookie)?.value, result.data.user.id);
        if (!integrationState) return go("/settings?integration=failed", true);
        try { await completeGoogleIntegration(client, result.data.user, result.data.session, integrationState.authorized, integrationState.enabled); }
        catch { return go("/settings?integration=failed", true); }
        return go("/settings?integration=connected", true);
      }
      return go(safeReturnTo(request.nextUrl.searchParams.get("next")));
    } catch { return googleIntegration ? go("/settings?integration=failed", true) : go("/login?error=oauth-failed"); }
  }
  if (!token.success || !["signup", "recovery"].includes(type ?? "")) {
    await clearRecoveryToken();
    return go("/login?error=invalid-link");
  }
  try {
    if (type === "recovery") {
      // No state-changing Auth call on GET: email scanners cannot consume recovery links.
      // The hash is stripped from the URL and kept only in a short-lived HttpOnly cookie.
      await storeRecoveryToken(token.data);
      return go("/reset-password");
    }
    const supabase = await createClient({ writable: true });
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token.data, type: "signup" });
    if (error || !data.user || !data.session) return go("/login?error=invalid-link");
    await clearRecoveryToken();
    return go(safeReturnTo(request.nextUrl.searchParams.get("next")));
  } catch {
    await clearRecoveryToken();
    return go("/login?error=invalid-link");
  }
}
