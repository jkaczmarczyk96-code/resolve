import { z } from "zod";
import { failure, identity, json, WorkspaceError } from "@/lib/workspace/http";
import { getProblem } from "@/lib/workspace/repository";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { client, user } = await identity(); const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw new WorkspaceError("NOT_FOUND", 404);
    return json(await getProblem(client, user.id, id));
  } catch (error) { return failure(error); }
}
