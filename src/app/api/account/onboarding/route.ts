import { z } from "zod";
import { body, failure, identity, json, WorkspaceError } from "@/lib/workspace/http";

const onboardingSchema = z.strictObject({ outcome: z.enum(["completed", "skipped"]) });

export async function POST(request: Request) {
  try {
    const { client, user } = await identity();
    const input = onboardingSchema.safeParse(await body(request));
    if (!input.success) throw new WorkspaceError("INVALID_INPUT");
    const result = await client.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id).select("id").abortSignal(AbortSignal.timeout(10_000)).single();
    if (result.error) throw new WorkspaceError("SERVICE_UNAVAILABLE", 503);
    await client.rpc("record_product_event", { p_event_name: input.data.outcome === "completed" ? "onboarding_completed" : "onboarding_skipped", p_path: "/dashboard", p_properties: {} }).abortSignal(AbortSignal.timeout(5_000));
    return json({ saved: true });
  } catch (error) { return failure(error); }
}
