import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/config/server-env";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { enabledOAuthProviders } from "@/lib/auth/oauth";
import { safeReturnTo } from "@/lib/auth/routes";
export async function POST(request: Request) {
  const origin = getSiteOrigin();
  if (request.headers.get("origin") !== origin) return new Response("Invalid origin", { status: 403 });
  const form = await request.formData(); const provider = form.get("provider");
  if ((provider !== "google" && provider !== "apple") || !enabledOAuthProviders().includes(provider)) return NextResponse.redirect(`${origin}/login?error=oauth-unavailable`, 303);
  try {
    const client = await createClient({ writable: true });
    const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeReturnTo(form.get("next")))}`, skipBrowserRedirect: true } });
    if (result.error || !result.data.url) throw new Error("OAuth unavailable");
    const target = new URL(result.data.url);
    if (target.origin !== new URL(getPublicEnvironment().url).origin || target.pathname !== "/auth/v1/authorize") throw new Error("Unexpected OAuth destination");
    return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return NextResponse.redirect(`${origin}/login?error=oauth-unavailable`, 303); }
}
