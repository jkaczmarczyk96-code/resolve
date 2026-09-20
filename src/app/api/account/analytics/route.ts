import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";

const choiceSchema = z.strictObject({ enabled: z.boolean() });

export async function POST(request: Request) {
  try {
    const { client, user } = await identity();
    const input = choiceSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.from("profiles").update({ product_analytics_enabled: input.data.enabled }).eq("id", user.id).select("id").abortSignal(AbortSignal.timeout(10_000)).single();
    if (result.error) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    return json({ saved: true });
  } catch (error) { return failure(error); }
}
