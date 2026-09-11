import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { parseFullSnapshot } from "@/lib/orchestration/full-state";
import { webJobSchema, type WebJob } from "./contracts";
import { WorkspaceError } from "./http";

const jobColumns = "id,problem_id,status,error,expires_at,created_at";
function job(row: { id: string; problem_id: string | null; status: string; error: string | null; expires_at: string }): WebJob {
  return webJobSchema.parse({ id: row.id, problemId: row.problem_id, status: row.status, error: row.error, expiresAt: row.expires_at });
}
export async function listProblems(client: SupabaseClient<Database>, userId: string) {
  const problems = await client.from("problems").select("id,title,original_input,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(10_000));
  if (problems.error) throw new WorkspaceError("LOAD_FAILED", 503);
  if (!problems.data.length) return [];
  const jobs = await client.from("web_runs").select(jobColumns).eq("user_id", userId).in("problem_id", problems.data.map((item) => item.id)).order("created_at", { ascending: false }).limit(300).abortSignal(AbortSignal.timeout(10_000));
  if (jobs.error) throw new WorkspaceError("LOAD_FAILED", 503);
  return problems.data.map((problem) => { const latest = jobs.data.find((item) => item.problem_id === problem.id); return { problem, job: latest ? job(latest) : null }; });
}
export async function getProblem(client: SupabaseClient<Database>, userId: string, id: string) {
  const problem = await client.from("problems").select("id,title,original_input,created_at").eq("id", id).eq("user_id", userId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (problem.error) throw new WorkspaceError("LOAD_FAILED", 503);
  if (!problem.data) throw new WorkspaceError("NOT_FOUND", 404);
  const jobs = await client.from("web_runs").select(jobColumns).eq("problem_id", id).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(10_000));
  if (jobs.error) throw new WorkspaceError("LOAD_FAILED", 503);
  const latest = jobs.data[0]; let snapshot = null;
  if (latest) {
    const run = await client.from("full_workflow_runs").select("snapshot").eq("id", latest.id).eq("problem_id", id).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (run.error) throw new WorkspaceError("LOAD_FAILED", 503);
    if (run.data) { snapshot = parseFullSnapshot(run.data.snapshot); if (snapshot.id !== latest.id || snapshot.problemId !== id) throw new WorkspaceError("INVALID_RESULT", 503); }
  }
  let humanRequest = null;
  if (latest) {
    const input = await client.from("human_requests").select("questions,answers,answered_at").eq("run_id", latest.id).eq("user_id", userId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (input.error) throw new WorkspaceError("LOAD_FAILED", 503);
    if (input.data) humanRequest = { runId: latest.id, questions: input.data.questions, answers: input.data.answers, answeredAt: input.data.answered_at };
  }
  return { problem: problem.data, job: latest ? job(latest) : null, snapshot, humanRequest };
}
