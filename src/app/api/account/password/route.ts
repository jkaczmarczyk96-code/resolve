import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { passwordChangeSchema } from "@/lib/account/contracts";
import { verifyPassword } from "@/lib/account/security";
export async function POST(request: Request) {
  try {
    const { user } = await identity(); const input = passwordChangeSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_PASSWORD");
    const proof = await verifyPassword(user, input.data.currentPassword);
    try {
      const result = await proof.auth.updateUser({ password: input.data.password });
      if (result.error) throw new WorkspaceError("PASSWORD_FAILED", 409);
      return json({ saved: true });
    } finally { await proof.auth.signOut({ scope: "local" }); }
  } catch (error) { return failure(error); }
}
