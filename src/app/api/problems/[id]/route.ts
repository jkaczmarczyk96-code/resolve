import { z } from "zod";
import { after } from "next/server";
import { failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { getProblem } from "@/lib/workspace/repository";
import { detachedClient, execute, recover } from "@/lib/workspace/execution";
export const maxDuration = 300;
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client, user } = await identity(); const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new WorkspaceError("NOT_FOUND", 404);
    const recovery = await recover(client, user.id, id);
    if (recovery) {
      const worker = await detachedClient(client);
      after(() => execute(worker, recovery.job.id, recovery.secret, Date.now()));
    }
    return json(await getProblem(client, user.id, id));
  } catch (error) { return failure(error); }
}
