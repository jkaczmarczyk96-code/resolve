import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { getSiteOrigin } from "@/lib/config/server-env";
import type { Database } from "@/lib/database/types";

/** Request-scoped, RLS-bound client. Writable only in Server Actions/Route Handlers. */
export async function createClient({ writable = false }: { writable?: boolean } = {}) {
  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicEnvironment();
  return createServerClient<Database>(url, publishableKey, {
    cookieOptions: { sameSite: "lax", secure: getSiteOrigin().startsWith("https:") },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Proxy refreshes before Server Components. Mutations explicitly opt into writes.
        if (!writable) return;
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
