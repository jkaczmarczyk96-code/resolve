import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/config/server-env";
import { bounded } from "@/lib/ai/errors";

export class WorkspaceError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
export function failure(error: unknown) {
  return error instanceof WorkspaceError ? json({ error: error.code }, error.status) : json({ error: "SERVICE_UNAVAILABLE" }, 503);
}
export async function identity() {
  const client = await createClient({ writable: true });
  const { data, error } = await bounded(() => client.auth.getUser(), 10_000);
  if (error || !data.user) throw new WorkspaceError("SIGN_IN_REQUIRED", 401);
  return { client, user: data.user };
}
export async function body(request: Request) {
  if (request.headers.get("origin") !== getSiteOrigin()) throw new WorkspaceError("INVALID_ORIGIN", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new WorkspaceError("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("INVALID_REQUEST");
  const decoder = new TextDecoder(); let result = ""; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 60_000) { await reader.cancel(); throw new WorkspaceError("INPUT_TOO_LARGE", 413); }
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    try { return JSON.parse(result) as unknown; } catch { throw new WorkspaceError("INVALID_REQUEST"); }
  } finally { reader.releaseLock(); }
}
