import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { runBasicWorkflow } from "@/lib/orchestration/basic";
import { createWorkflowStore } from "@/lib/orchestration/supabase-store";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { inputs } from "../fixtures/ai";
import { MemoryWorkflowStore, workflowRequest } from "../fixtures/workflow";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== "http://127.0.0.1:55421" || !key?.startsWith("sb_publishable_")) throw new Error("Workflow tests require the Resolve local Supabase stack.");
const client = () => createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

it("model-only: runs the real three-agent chain independently of Docker", async () => {
  const result = await runBasicWorkflow(workflowRequest(), new MemoryWorkflowStore(), { ai: createNebiusProvider() });
  expect({ state: result.state, error: result.error }).toEqual({ state: "COMPLETED", error: null });
  expect(result.decision?.confidence).toBe("low");
});

it("runs real Nebius Intake → Plan → Decide with durable authenticated Supabase checkpoints", async () => {
  const a = client();
  const fresh = client();
  const email = `resolve-workflow-${randomUUID()}@example.com`;
  const password = "ResolveWorkflowTest12";
  const signup = await a.auth.signUp({ email, password, options: { emailRedirectTo: "http://127.0.0.1:3000/auth/callback?next=/dashboard" } });
  expect(signup.error?.name ?? null).toBeNull();
  let token: string | undefined;
  await expect.poll(async () => {
    const inbox: { messages?: { ID: string }[] } = await (await fetch(`http://127.0.0.1:55424/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    for (const message of inbox.messages ?? []) {
      const detail: { HTML?: string } = await (await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`)).json();
      const href = detail.HTML?.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&");
      if (href) token = new URL(href).searchParams.get("token_hash") ?? undefined;
    }
    return Boolean(token);
  }, { timeout: 15_000 }).toBe(true);
  if (!token) throw new Error("Local confirmation email missing");
  const verified = await a.auth.verifyOtp({ token_hash: token, type: "signup" });
  expect(verified.error?.name ?? null).toBeNull();
  if (!verified.data.user) throw new Error("Local test user missing");
  // PostgREST schema cache can finish starting after Auth becomes healthy.
  await expect.poll(async () => (await a.from("problems").select("id").limit(1)).error === null, { timeout: 30_000 }).toBe(true);
  const problem = await a.from("problems").insert({ user_id: verified.data.user.id, title: "Fictional workflow verification", original_input: inputs.intake.description }).select("id").single();
  expect(problem.error?.code ?? null).toBeNull();
  if (!problem.data) throw new Error("Local test problem missing");
  try {
    const store = await createWorkflowStore(a);
    const runId = randomUUID();
    const result = await runBasicWorkflow({ runId, problemId: problem.data.id }, store, { ai: createNebiusProvider() });
    expect({ state: result.state, error: result.error }).toEqual({ state: "COMPLETED", error: null });
    expect(result.events.map((event) => event.state)).toEqual(["PENDING", "INTAKE", "PLAN", "DECIDE", "COMPLETED"]);
    expect(result.decision?.confidence).toBe("low");
    expect(result.decision?.supportingEvidence).toEqual([]);
    const login = await fresh.auth.signInWithPassword({ email, password });
    expect(login.error?.name ?? null).toBeNull();
    const reconnected = await createWorkflowStore(fresh);
    expect(await reconnected.load(runId)).toEqual(result);
    await expect(store.create(result)).rejects.toMatchObject({ code: "PERSISTENCE" });
    await expect(store.save(result, 0)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createWorkflowStore(client())).rejects.toMatchObject({ code: "AUTHENTICATION" });
  } finally {
    await a.from("problems").delete().eq("id", problem.data.id);
    await a.auth.signOut({ scope: "local" });
    await fresh.auth.signOut({ scope: "local" });
  }
});
