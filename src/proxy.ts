import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { isPrivatePath, safeReturnTo } from "@/lib/auth/routes";
import type { Database } from "@/lib/database/types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Missing configuration must fail closed without turning the public forms into 500s.
  let config: ReturnType<typeof getPublicEnvironment>;
  try { config = getPublicEnvironment(); } catch {
    if (isPrivatePath(request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("error", "configuration");
      url.searchParams.set("next", safeReturnTo(request.nextUrl.pathname + request.nextUrl.search));
      response = NextResponse.redirect(url);
    }
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookieOptions: { sameSite: "lax", secure: request.nextUrl.protocol === "https:" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response.cookies.getAll();
        response = NextResponse.next({ request });
        previous.forEach((cookie) => response.cookies.set(cookie));
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (isPrivatePath(request.nextUrl.pathname) && (error || !data.user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", safeReturnTo(request.nextUrl.pathname + request.nextUrl.search));
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/login", "/register", "/forgot-password", "/reset-password", "/auth/:path*", "/dashboard/:path*", "/problems/:path*", "/notifications/:path*", "/settings/:path*"],
};
