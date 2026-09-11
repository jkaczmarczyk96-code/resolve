import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/config/server-env";
import { safeReturnTo } from "@/lib/auth/routes";
import { clearRecoveryToken, storeRecoveryToken } from "@/lib/auth/recovery";
import { recoveryTokenSchema } from "@/lib/auth/schemas";

export async function GET(request: NextRequest) {
  let origin: string;
  try { origin = getSiteOrigin(); } catch {
    return new NextResponse("Account service is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  function go(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  const token = recoveryTokenSchema.safeParse(request.nextUrl.searchParams.get("token_hash"));
  const type = request.nextUrl.searchParams.get("type");
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
