import { productEventSchema } from "@/lib/product/analytics";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";

export async function POST(request: Request) {
  try {
    const { client } = await identity();
    const input = productEventSchema.safeParse(await body(request));
    if (!input.success || JSON.stringify(input.data.properties).length > 2048) throw new WorkspaceError("INVALID_EVENT");
    const result = await client.rpc("record_product_event", { p_event_name: input.data.event, p_path: input.data.path, p_properties: input.data.properties }).abortSignal(AbortSignal.timeout(5_000));
    if (result.error) throw new WorkspaceError(result.error.message.includes("RATE_LIMIT") ? "RATE_LIMIT" : "SERVICE_UNAVAILABLE", result.error.message.includes("RATE_LIMIT") ? 429 : 503);
    return json({ recorded: true }, 201);
  } catch (error) { return failure(error); }
}
