import "server-only";
import type { User } from "@supabase/supabase-js";
import { createEphemeralClient } from "@/lib/supabase/ephemeral";
import { WorkspaceError } from "@/lib/workspace/http";

export async function verifyPassword(user: User, password: string) {
  if (!user.email || !password) throw new WorkspaceError("REAUTH_REQUIRED", 403);
  const proof = createEphemeralClient();
  const result = await proof.auth.signInWithPassword({ email: user.email, password });
  if (result.error || !result.data.session || result.data.user?.id !== user.id) {
    if (result.data.session) await proof.auth.signOut({ scope: "local" });
    throw new WorkspaceError("REAUTH_REQUIRED", 403);
  }
  return proof;
}

export function recentOAuth(claims: unknown, userId: string, now = Date.now()) {
  if (typeof claims !== "object" || !claims || !("sub" in claims) || claims.sub !== userId || !("amr" in claims) || !Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object" || !("method" in entry) || entry.method !== "oauth" || !("timestamp" in entry) || typeof entry.timestamp !== "number") return false;
    const age = now / 1000 - entry.timestamp;
    return age >= 0 && age < 300;
  });
}
