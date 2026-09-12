import "server-only";
import { z } from "zod";
import { fullSnapshotSchema } from "@/lib/orchestration/full-state";
import { createHmac } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { getPublicEnvironment } from "@/lib/config/public-env";
import { getAIConfiguration } from "@/lib/ai/models";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";
import { AIError } from "@/lib/ai/errors";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { createFullWorkflowStore } from "@/lib/orchestration/supabase-store";
import { webJobSchema } from "./contracts";
import { WorkspaceError } from "./http";

export function workerSecret(userId: string, requestId: string) {
  return createHmac("sha256", getAIConfiguration().apiKey).update(`resolve-web-v1:${userId}:${requestId}`).digest("hex");
}
export async function reserve(client: SupabaseClient<Database>, userId: string, requestId: string, description: string | null, problemId: string | null) {
  // Fail before creating records when required providers are not configured.
  createNebiusProvider(); createTavilyProvider();
  const secret = workerSecret(userId, requestId);
  const { data, error } = await client.rpc("reserve_web_run", { p_request_id: requestId, p_secret: secret, p_problem_id: problemId, p_description: description }).abortSignal(AbortSignal.timeout(10_000));
  if (error) {
    const allowed = ["CONFLICT", "NOT_FOUND", "ACTIVE_RUN", "DAILY_LIMIT", "ATTEMPT_LIMIT", "ALREADY_COMPLETED", "INVALID_INPUT", "INPUT_REQUIRED"];
    const code = allowed.includes(error.message) ? error.message : "SERVICE_UNAVAILABLE";
    throw new WorkspaceError(code, code === "NOT_FOUND" ? 404 : code.includes("LIMIT") ? 429 : code === "SERVICE_UNAVAILABLE" ? 503 : 409);
  }
  return { job: webJobSchema.parse(data), secret };
}
export async function detachedClient(client: SupabaseClient<Database>) {
  let session = (await client.auth.getSession()).data.session;
  if (session && (session.expires_at ?? 0) < Date.now() / 1000 + 960) {
    const refresh = await client.auth.refreshSession(); if (refresh.error) throw new WorkspaceError("SIGN_IN_REQUIRED", 401); session = refresh.data.session;
  }
  if (!session) throw new WorkspaceError("SIGN_IN_REQUIRED", 401);
  const { url, publishableKey } = getPublicEnvironment();
  return createSupabaseClient<Database>(url, publishableKey, { global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export async function execute(client: SupabaseClient<Database>, runId: string, secret: string, startedAt = Date.now()) {
  let claimed = false;
  let deadline = startedAt + 240_000;
  try {
    const claim = await client.rpc("claim_web_run", { p_run_id: runId, p_secret: secret }).abortSignal(AbortSignal.timeout(10_000));
    if (claim.error || !claim.data) return;
    const job = webJobSchema.extend({ recover: z.boolean().optional(), resume: z.object({ checkpoint: fullSnapshotSchema, responseId: z.uuid(), answers: z.array(z.string().trim().min(1).max(1200)).min(1).max(8) }).nullable().optional() }).parse(claim.data); if (!job.problemId) return;
    claimed = true;
    // Include request setup and claim time; reserve 60 seconds for abort and final status writes.
    deadline = Math.min(deadline, Date.parse(job.expiresAt) - 30_000);
    const signal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    const check = () => { if (Date.now() >= deadline || signal.aborted) throw new AIError("TIMEOUT"); };
    check();
    const store = await createFullWorkflowStore(client);
    const ai = createNebiusProvider(); const research = createTavilyProvider();
    const result = await runFullWorkflow({ runId, problemId: job.problemId }, {
      ...store, ...(job.resume ? { load: async () => job.resume!.checkpoint } : {}), create: async (value) => { check(); await store.create(value); }, save: async (value, version) => { check(); await store.save(value, version); },
    }, { ai: { model: ai.model, generate: (request) => { check(); return ai.generate(request); } }, research: { search: (question, parent) => { check(); return research.search(question, parent); } } }, { signal, humanInput: true, preserveInterrupt: true, ...(job.resume ? { resume: { responseId: job.resume.responseId, answers: job.resume.answers } } : job.recover ? { recover: true } : {}) });
    if (result.state === "ACTION_REQUIRED") {
      const paused = await client.rpc("pause_web_run", { p_run_id: runId, p_secret: secret, p_checkpoint: result }).abortSignal(AbortSignal.timeout(10_000));
      if (paused.error || !paused.data) throw new Error("Pause checkpoint failed");
      return;
    }
    const finish = await client.rpc("finish_web_run", { p_run_id: runId, p_secret: secret, p_status: result.state === "COMPLETED" ? "completed" : "failed", p_error: result.state !== "COMPLETED" && Date.now() >= deadline ? "TIMEOUT" : result.error }).abortSignal(AbortSignal.timeout(10_000));
    if (finish.error) console.error("Workflow status update failed");
  } catch (error) {
    if (!claimed) return;
    const code = Date.now() >= deadline ? "TIMEOUT" : error instanceof AIError ? error.code : "PERSISTENCE";
    if (code === "TIMEOUT" || code === "CANCELLED") {
      try {
        const yielded = await client.rpc("yield_web_run", { p_run_id: runId, p_secret: secret }).abortSignal(AbortSignal.timeout(10_000));
        if (!yielded.error && yielded.data) return;
      } catch { console.error("Workflow checkpoint yield failed"); }
    }
    try { await client.rpc("finish_web_run", { p_run_id: runId, p_secret: secret, p_status: "failed", p_error: code }).abortSignal(AbortSignal.timeout(10_000)); } catch { console.error("Workflow status update failed"); }
  }
}

export async function recover(client: SupabaseClient<Database>, userId: string, problemId: string) {
  const latest = await client.from("web_runs").select("id,status,expires_at").eq("user_id", userId).eq("problem_id", problemId).order("created_at", { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (latest.error || !latest.data || !["queued", "running"].includes(latest.data.status)) return null;
  const secret = workerSecret(userId, latest.data.id);
  if (latest.data.status === "running" && Date.parse(latest.data.expires_at) > Date.now()) return null;
  const resumed = await client.rpc("recover_web_run", { p_run_id: latest.data.id, p_secret: secret }).abortSignal(AbortSignal.timeout(10_000));
  if (resumed.error || !resumed.data) return null;
  return { job: webJobSchema.parse(resumed.data), secret };
}

export async function respond(client: SupabaseClient<Database>, userId: string, problemId: string, runId: string, requestId: string, answers: string[]) {
  createNebiusProvider(); createTavilyProvider();
  const secret = workerSecret(userId, runId);
  const result = await client.rpc("respond_web_run", { p_run_id: runId, p_problem_id: problemId, p_secret: secret, p_response_id: requestId, p_answers: answers }).abortSignal(AbortSignal.timeout(10_000));
  if (result.error) {
    const allowed = ["NOT_FOUND", "CONFLICT", "NOT_WAITING", "RESPONSE_CONFLICT", "ACTIVE_RUN", "INVALID_INPUT"];
    const code = allowed.includes(result.error.message) ? result.error.message : "SERVICE_UNAVAILABLE";
    throw new WorkspaceError(code, code === "NOT_FOUND" ? 404 : code === "SERVICE_UNAVAILABLE" ? 503 : 409);
  }
  return { job: webJobSchema.parse(result.data), secret };
}
