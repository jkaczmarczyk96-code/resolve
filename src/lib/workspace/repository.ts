import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { parseFullSnapshot } from "@/lib/orchestration/full-state";
import { webJobSchema, type WebJob } from "./contracts";
import { WorkspaceError } from "./http";
import { GOOGLE_CALENDAR_WRITE_SCOPE } from "@/lib/integrations/google";

const jobColumns = "id,problem_id,status,error,expires_at,created_at";
function job(row: { id: string; problem_id: string | null; status: string; error: string | null; expires_at: string }): WebJob {
  return webJobSchema.parse({ id: row.id, problemId: row.problem_id, status: row.status, error: row.error, expiresAt: row.expires_at });
}
export async function listProblems(client: SupabaseClient<Database>, userId: string) {
  const problems = await client.from("problems").select("id,title,original_input,status,created_at,solved_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100).abortSignal(AbortSignal.timeout(10_000));
  if (problems.error) throw new WorkspaceError("LOAD_FAILED", 503);
  if (!problems.data.length) return [];
  const problemIds = problems.data.map((item) => item.id);
  const [jobs,dueTasks] = await Promise.all([
    client.from("web_runs").select(jobColumns).eq("user_id", userId).in("problem_id", problemIds).order("created_at", { ascending: false }).limit(300).abortSignal(AbortSignal.timeout(10_000)),
    client.from("tasks").select("problem_id").in("problem_id",problemIds).in("status",["pending","in_progress"]).not("due_at","is",null).lte("due_at",new Date(Date.now()+7*24*60*60*1000).toISOString()).abortSignal(AbortSignal.timeout(10_000)),
  ]);
  if (jobs.error || dueTasks.error) throw new WorkspaceError("LOAD_FAILED", 503);
  const dueCounts = new Map<string,number>();
  for (const task of dueTasks.data) dueCounts.set(task.problem_id,(dueCounts.get(task.problem_id)??0)+1);
  return problems.data.map((problem) => { const latest = jobs.data.find((item) => item.problem_id === problem.id); return { problem, job: latest ? job(latest) : null, dueTaskCount: problem.status==="solved" ? 0 : dueCounts.get(problem.id)??0 }; });
}
export async function getProblem(client: SupabaseClient<Database>, userId: string, id: string) {
  const problem = await client.from("problems").select("id,title,original_input,status,created_at,solved_at").eq("id", id).eq("user_id", userId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
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
  const monitors = await client.from("monitoring_conditions").select("id,problem_id,description,search_query,status,last_result,last_error,last_checked_at,next_check_at").eq("problem_id", id).eq("user_id", userId).order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(10_000));
  if (monitors.error) throw new WorkspaceError("LOAD_FAILED", 503);
  const conditions = monitors.data.map((item) => ({ id: item.id, problemId: item.problem_id, description: item.description, searchQuery: item.search_query, status: item.status, lastResult: item.last_result, lastError: item.last_error, lastCheckedAt: item.last_checked_at, nextCheckAt: item.next_check_at }));
  const [taskRows,lifecycleRows,actionRows,integration]=await Promise.all([
    latest ? client.from("tasks").select("id,source_task_id,status,completed_at,due_at").eq("problem_id",id).eq("workflow_run_id",latest.id).order("created_at").abortSignal(AbortSignal.timeout(10_000)) : Promise.resolve({ data:[],error:null }),
    client.from("problem_lifecycle_events").select("id,event,created_at").eq("problem_id",id).eq("user_id",userId).order("created_at",{ ascending:false }).limit(50).abortSignal(AbortSignal.timeout(10_000)),
    client.from("external_actions").select("id,problem_id,action_type,status,payload,result,error,attempt_count,requested_at,approved_at,executed_at").eq("problem_id",id).eq("user_id",userId).order("requested_at",{ ascending:false }).limit(50).abortSignal(AbortSignal.timeout(10_000)),
    client.from("integrations").select("status,scopes,enabled_services").eq("user_id",userId).eq("provider","google").abortSignal(AbortSignal.timeout(10_000)).maybeSingle(),
  ]);
  if (taskRows.error || lifecycleRows.error || actionRows.error || integration.error) throw new WorkspaceError("LOAD_FAILED",503);
  const tasks=taskRows.data.filter((item)=>item.source_task_id).map((item)=>({ id:item.id,sourceId:item.source_task_id!,status:item.status,completedAt:item.completed_at,dueAt:item.due_at }));
  const lifecycle=lifecycleRows.data.map((item)=>({ id:item.id,event:item.event as "solved"|"reopened",createdAt:item.created_at }));
  const actions=actionRows.data.map((item)=>({ id:item.id,problemId:item.problem_id,actionType:item.action_type,status:item.status,payload:item.payload,result:item.result,error:item.error,attemptCount:item.attempt_count,requestedAt:item.requested_at,approvedAt:item.approved_at,executedAt:item.executed_at }));
  const connected=integration.data?.status==="connected";
  const actionAccess={ calendarEnabled:Boolean(connected&&integration.data?.enabled_services.includes("calendar")),calendarWriteAuthorized:Boolean(connected&&integration.data?.scopes.includes(GOOGLE_CALENDAR_WRITE_SCOPE)) };
  return { problem: problem.data, job: latest ? job(latest) : null, snapshot, humanRequest, conditions,tasks,lifecycle,actions,actionAccess };
}
