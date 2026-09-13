import { createClient } from "@supabase/supabase-js";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { deletionSchema } from "@/lib/account/contracts";
import { recentOAuth, verifyPassword } from "@/lib/account/security";
import { getPublicEnvironment } from "@/lib/config/public-env";
export async function POST(request: Request) {
  try {
    const { client, user } = await identity(); const input = deletionSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("DELETE_CONFIRMATION");
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key?.startsWith("sb_secret_")) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    if (input.data.currentPassword) {
      const proof = await verifyPassword(user, input.data.currentPassword); await proof.auth.signOut({ scope: "local" });
    } else {
      const result = await client.auth.getClaims();
      if (result.error || !recentOAuth(result.data?.claims, user.id)) throw new WorkspaceError("REAUTH_REQUIRED", 403);
    }
    const admin = createClient(getPublicEnvironment().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw new WorkspaceError("DELETE_FAILED", 503);
    try { await client.auth.signOut({ scope: "local" }); } catch { /* Deletion already succeeded. */ }
    return json({ deleted: true });
  } catch (error) { return failure(error); }
}
