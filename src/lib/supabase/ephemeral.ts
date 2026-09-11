import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getPublicEnvironment } from "@/lib/config/public-env";
import type { Database } from "@/lib/database/types";

/** Recovery/email requests must not overwrite a different account's browser session. */
export function createEphemeralClient() {
  const { url, publishableKey } = getPublicEnvironment();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
