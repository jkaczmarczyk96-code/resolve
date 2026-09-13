import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/config/server-env";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { enabledOAuthProviders } from "@/lib/auth/oauth";
import { safeReturnTo } from "@/lib/auth/routes";

function hasSameOrigin(request: Request, expectedOrigin: string) {
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === expectedOrigin; } catch { return false; }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

async function startOAuth(request: Request, provider: FormDataEntryValue | string | null, next: FormDataEntryValue | string | null) {
  const origin = getSiteOrigin();
  if (!hasSameOrigin(request, origin)) return new Response("Invalid origin", { status: 403 });
  if ((provider !== "google" && provider !== "apple") || !enabledOAuthProviders().includes(provider)) return NextResponse.redirect(`${origin}/login?error=oauth-unavailable`, 303);
  try {
    const client = await createClient({ writable: true });
    const result = await client.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeReturnTo(next))}`, skipBrowserRedirect: true } });
    if (result.error || !result.data.url) throw new Error("OAuth unavailable");
    const target = new URL(result.data.url);
    if (target.origin !== new URL(getPublicEnvironment().url).origin || target.pathname !== "/auth/v1/authorize") throw new Error("Unexpected OAuth destination");
    return NextResponse.redirect(target, { status: 303, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return NextResponse.redirect(`${origin}/login?error=oauth-unavailable`, 303); }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return startOAuth(request, url.searchParams.get("provider"), url.searchParams.get("next"));
}

export async function POST(request: Request) {
  const form = await request.formData();
  return startOAuth(request, form.get("provider"), form.get("next"));
}
