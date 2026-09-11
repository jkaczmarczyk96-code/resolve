import { after } from "next/server";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { submissionSchema } from "@/lib/workspace/contracts";
import { detachedClient, execute, reserve } from "@/lib/workspace/execution";
import { listProblems } from "@/lib/workspace/repository";
export const maxDuration = 300;
export const runtime = "nodejs";
export async function GET() {
  try { const { client, user } = await identity(); return json(await listProblems(client, user.id)); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const { client, user } = await identity();
    const input = submissionSchema.safeParse(await body(request)); if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const worker = await detachedClient(client);
    const { job, secret } = await reserve(client, user.id, input.data.requestId, input.data.description, null);
    after(() => execute(worker, job.id, secret, startedAt));
    return json(job, 202);
  } catch (error) { return failure(error); }
}
