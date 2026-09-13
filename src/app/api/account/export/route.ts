import { failure, identity, WorkspaceError } from "@/lib/workspace/http";
export async function GET() {
  try {
    const { client, user } = await identity();
    const result = await client.rpc("export_account_data").abortSignal(AbortSignal.timeout(30_000));
    if (result.error || !result.data) throw new WorkspaceError("EXPORT_FAILED", 503);
    return new Response(JSON.stringify({ account: { id: user.id, email: user.email, createdAt: user.created_at, providers: user.identities?.map((entry) => entry.provider) ?? [] }, data: result.data }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="avenli-account-export.json"', "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failure(error); }
}
