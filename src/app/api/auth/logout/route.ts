import { createClient } from "@/lib/supabase/server";
import { clearRecoveryToken } from "@/lib/auth/recovery";
import { body, failure, json, WorkspaceError } from "@/lib/workspace/http";

export async function POST(request: Request) {
  try {
    await body(request);
    const client = await createClient({ writable: true });
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new WorkspaceError("SIGN_OUT_FAILED", 503);
    await clearRecoveryToken();
    return json({ signedOut: true });
  } catch (error) { return failure(error); }
}
