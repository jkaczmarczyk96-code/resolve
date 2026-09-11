"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/lib/config/public-env";
import type { Database } from "@/lib/database/types";

export function createClient() {
  const { url, publishableKey } = getPublicEnvironment();
  return createBrowserClient<Database>(url, publishableKey, {
    cookieOptions: { sameSite: "lax", secure: typeof window !== "undefined" && window.location.protocol === "https:" },
  });
}
