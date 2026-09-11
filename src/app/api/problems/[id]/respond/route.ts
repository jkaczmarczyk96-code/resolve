import { after } from "next/server";
import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { responseSchema } from "@/lib/workspace/contracts";
import { detachedClient, execute, respond } from "@/lib/workspace/execution";
export const maxDuration = 300;
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  try {
    const { client, user } = await identity(); const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new WorkspaceError("NOT_FOUND", 404);
    const input = responseSchema.safeParse(await body(request)); if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const worker = await detachedClient(client);
    const { job, secret } = await respond(client, user.id, id, input.data.runId, input.data.requestId, input.data.answers);
    after(() => execute(worker, job.id, secret, startedAt));
    return json(job, 202);
  } catch (error) { return failure(error); }
}
