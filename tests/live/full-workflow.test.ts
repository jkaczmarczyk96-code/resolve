import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";
import { createFullWorkflowStore } from "@/lib/orchestration/supabase-store";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { fullStates, parseFullSnapshot } from "@/lib/orchestration/full-state";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (url !== "http://127.0.0.1:55421" || !key?.startsWith("sb_publishable_") || !process.env.NEBIUS_API_KEY || !process.env.TAVILY_API_KEY) throw new Error("Full live test requires local Resolve Supabase and configured AI/search keys.");
const client = () => createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function account() {
  const supabase = client(); const email = `resolve-full-${randomUUID()}@example.com`; const password = "ResolveFullWorkflow12";
  expect((await supabase.auth.signUp({ email, password, options: { emailRedirectTo: "http://127.0.0.1:3000/auth/callback?next=/dashboard" } })).error?.name ?? null).toBeNull();
  let token: string | undefined;
  await expect.poll(async () => {
    const inbox: { messages?: { ID: string }[] } = await (await fetch(`http://127.0.0.1:55424/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`, { signal: AbortSignal.timeout(5000) })).json();
    for (const message of inbox.messages ?? []) {
      const detail: { HTML?: string } = await (await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`, { signal: AbortSignal.timeout(5000) })).json();
      const href = detail.HTML?.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&");
      if (href) token = new URL(href).searchParams.get("token_hash") ?? undefined;
    }
    return Boolean(token);
  }, { timeout: 15_000 }).toBe(true);
  if (!token) throw new Error("Local confirmation missing");
  const verified = await supabase.auth.verifyOtp({ token_hash: token, type: "signup" });
  expect(verified.error?.name ?? null).toBeNull();
  if (!verified.data.user) throw new Error("Local user missing");
  return { supabase, email, password, id: verified.data.user.id };
}
it("runs eight real agents plus Tavily and persists a full owner-isolated workflow", async () => {
  const a = await account(); const b = await account(); const fresh = client();
  await expect.poll(async () => (await a.supabase.from("full_workflow_runs").select("id").limit(1)).error === null, { timeout: 30_000 }).toBe(true);
  const problem = await a.supabase.from("problems").insert({ user_id: a.id, title: "Public documentation research test", original_input: "Create a small developer checklist comparing JSON object output and JSON schema output in Nebius Token Factory. Research only official public Nebius documentation. The output is a draft checklist for one developer to review; no deployment or external actions are needed." }).select("id").single();
  expect(problem.error?.code ?? null).toBeNull(); if (!problem.data) throw new Error("Test problem missing");
  try {
    const store = await createFullWorkflowStore(a.supabase);
    const result = await runFullWorkflow({ runId: randomUUID(), problemId: problem.data.id }, store, { ai: createNebiusProvider(), research: createTavilyProvider() });
    expect({ state: result.state, error: result.error, lastStage: result.events.at(-2)?.state }).toEqual({ state: "COMPLETED", error: null, lastStage: "TASKS" });
    expect(result.events.map((event) => event.state)).toEqual(fullStates);
    expect(result.research?.sources.length).toBeGreaterThan(0);
    expect(result.tasks?.tasks.every((task) => task.status === "proposed")).toBe(true);
    expect((await fresh.auth.signInWithPassword({ email: a.email, password: a.password })).error?.name ?? null).toBeNull();
    expect(await (await createFullWorkflowStore(fresh)).load(result.id)).toEqual(result);
    const other = await createFullWorkflowStore(b.supabase);
    await expect(other.load(result.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(other.save(result, 9)).rejects.toMatchObject({ code: "CONFLICT" });
    const initial = parseFullSnapshot({ ...result, id: randomUUID(), state: "PENDING", revision: 0, events: [result.events[0]], intake: null, plan: null, research: null, verification: null, options: null, critique: null, decision: null, tasks: null });
    await expect(other.create(initial)).rejects.toMatchObject({ code: "PERSISTENCE" });
    expect((await b.supabase.from("full_workflow_runs").delete().eq("id", result.id).select("id")).data).toEqual([]);
    await expect(store.save(result, 0)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createFullWorkflowStore(client())).rejects.toMatchObject({ code: "AUTHENTICATION" });
  } finally {
    await a.supabase.from("problems").delete().eq("id", problem.data.id);
    await a.supabase.auth.signOut({ scope: "local" }); await b.supabase.auth.signOut({ scope: "local" }); await fresh.auth.signOut({ scope: "local" });
  }
});
