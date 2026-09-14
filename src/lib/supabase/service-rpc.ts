import "server-only";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { WorkspaceError } from "@/lib/workspace/http";

export async function serviceRpc<T>(name: string, args: Record<string, unknown>) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret?.startsWith("sb_secret_")) throw new WorkspaceError("SERVICE_UNAVAILABLE",503);
  const response = await fetch(`${getPublicEnvironment().url}/rest/v1/rpc/${name}`,{
    method:"POST",cache:"no-store",signal:AbortSignal.timeout(10_000),
    headers:{ apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json" },body:JSON.stringify(args),
  });
  if (!response.ok) throw new WorkspaceError("SERVICE_UNAVAILABLE",503);
  return await response.json() as T;
}
