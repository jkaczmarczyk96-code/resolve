import "server-only";
import { z } from "zod";
import { runAgent, type AgentDependencies } from "@/lib/ai/agents";
import { AIError } from "@/lib/ai/errors";
import { intakeInput } from "@/lib/ai/schemas";
import { searchMany } from "@/lib/ai/research";
import { WorkflowError, type WorkflowStore } from "./state";
import { canAdvance, parseFullSnapshot, fullProblem, fullOptionsInput, fullCriticInput, fullDecisionInput, fullTasksInput, fullConfidence, type FullState, type FullSnapshot } from "./full-state";
import type { BasicRequest } from "./basic";

export async function runFullWorkflow(raw: BasicRequest, store: WorkflowStore<FullSnapshot>, deps: AgentDependencies, options: { signal?: AbortSignal; humanInput?: boolean; recover?: boolean; preserveInterrupt?: boolean; resume?: { responseId: string; answers: string[] } } = {}): Promise<FullSnapshot> {
  const request = z.strictObject({ runId: z.uuid(), problemId: z.uuid() }).safeParse(raw);
  if (!request.success) throw new WorkflowError("INVALID_REQUEST");
  if (options.signal?.aborted) throw new AIError("CANCELLED");
  if (!deps.research) throw new AIError("CONFIGURATION");
  const durable = async <T>(work: () => Promise<T>): Promise<T> => {
    try { return await work(); } catch (error) { throw error instanceof WorkflowError ? error : new WorkflowError("PERSISTENCE"); }
  };
  const problem = await durable(() => store.loadProblem(request.data.problemId));
  const input = intakeInput.safeParse({ description: problem.description });
  if (!input.success) throw new AIError("INVALID_INPUT");
  let current = options.resume || options.recover ? parseFullSnapshot(await durable(() => store.load(request.data.runId))) : parseFullSnapshot({ qualityPolicy: 1, version: 2, id: request.data.runId, problemId: request.data.problemId, description: input.data.description,
    model: deps.ai.model, state: "PENDING", revision: 0, intake: null, plan: null, research: null, verification: null, options: null, critique: null, decision: null, tasks: null, error: null,
    events: [{ state: "PENDING", at: new Date().toISOString() }],
  });
  if (options.resume) {
    if (current.id !== request.data.runId || current.problemId !== request.data.problemId || current.state !== "ACTION_REQUIRED" || !current.human || current.model !== deps.ai.model) throw new WorkflowError("INVALID_CHECKPOINT");
  } else if (options.recover) {
    if (current.id !== request.data.runId || current.problemId !== request.data.problemId || ["ACTION_REQUIRED", "COMPLETED", "FAILED", "CANCELLED"].includes(current.state) || current.model !== deps.ai.model) throw new WorkflowError("INVALID_CHECKPOINT");
  } else await durable(() => store.create(current));
  const advance = async (state: FullState, patch: Partial<Pick<FullSnapshot, "intake" | "plan" | "research" | "verification" | "options" | "critique" | "decision" | "tasks" | "error" | "human">> = {}) => {
    if (state !== "FAILED" && state !== "CANCELLED" && options.signal?.aborted) throw new AIError("CANCELLED");
    if (!canAdvance(current.state, state)) throw new WorkflowError("INVALID_CHECKPOINT");
    const next = parseFullSnapshot({ ...current, ...patch, state, revision: current.revision + 1, events: [...current.events, { state, at: new Date(Math.max(Date.now(), Date.parse(current.events.at(-1)!.at))).toISOString() }] });
    await durable(() => store.save(next, current.revision));
    current = next;
  };
  try {
    if (options.resume) {
      const human = current.human!;
      if (options.resume.answers.length !== human.questions.length) throw new WorkflowError("INVALID_REQUEST");
      await advance("RESUME", { human: { ...human, responseId: options.resume.responseId, responses: human.questions.map((question, index) => ({ question, answer: options.resume!.answers[index] })) } });
    }
    if (current.state === "RESUME") {
      const replanned = await runAgent("planner", { problem: fullProblem(current) }, deps, options);
      await advance("RESEARCH", { plan: replanned.output });
    }
    if (current.state === "PENDING") {
      await advance("INTAKE");
    }
    if (current.state === "INTAKE") {
      const understood = await runAgent("intake", input.data, deps, options);
      await advance("PLAN", { intake: understood.output });
    }
    if (current.state === "PLAN") {
      const planned = await runAgent("planner", { problem: fullProblem(current) }, deps, options);
      await advance("RESEARCH", { plan: planned.output });
    }
    if (current.state === "RESEARCH") {
      if (options.humanInput && !current.human) {
        const questions = [...new Set(current.plan!.steps.flatMap((step) => step.userQuestions))];
        if (questions.length > 8) throw new AIError("INVALID_OUTPUT");
        if (questions.length) {
          await advance("ACTION_REQUIRED", { human: { questions, responseId: null, responses: null } });
          return current;
        }
      }
      // Research at most three distinct, highest-priority questions without adding model calls.
      const priority = { high: 0, medium: 1, low: 2 };
      const planned=[...current.plan!.steps].sort((a,b)=>priority[a.priority]-priority[b.priority]).flatMap((step)=>step.researchQuestions);
      const questions=[...new Set(planned.length ? planned : [current.intake!.goal])].slice(0,3);
      const question=questions.length===1 ? questions[0] : questions.map((item,index)=>`${index+1}. ${item.slice(0,620)}`).join("\n");
      const researched=await runAgent("researcher",{ question },{ ...deps,research:{ search:(_combined,signal)=>searchMany(deps.research!,questions,signal) } },options);
      await advance("VERIFY",{ research:{ question,questions,output:researched.output,sources:researched.sources } });
    }
    if (current.state === "VERIFY") {
      const verified = await runAgent("verifier", { claims: current.research!.output.claims, sources: current.research!.sources }, deps, options);
      await advance("OPTIONS", { verification: verified.output });
    }
    if (current.state === "OPTIONS") {
      const candidates = await runAgent("options", fullOptionsInput(current), deps, options);
      await advance("CRITIQUE", { options: candidates.output });
    }
    if (current.state === "CRITIQUE") {
      const critiqued = await runAgent("critic", fullCriticInput(current), deps, options);
      await advance("DECIDE", { critique: critiqued.output });
    }
    if (current.state === "DECIDE") {
      const decided = await runAgent("decision", fullDecisionInput(current), deps, options);
      await advance("TASKS", { decision: { ...decided.output, confidence: fullConfidence(current, decided.output) } });
    }
    if (current.state === "TASKS") {
      const tasks = await runAgent("tasks", fullTasksInput(current), deps, options);
      await advance("COMPLETED", { tasks: tasks.output });
    }
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    const code = error instanceof AIError ? error.code : "PROVIDER";
    if (options.preserveInterrupt && (code === "CANCELLED" || code === "TIMEOUT")) throw error;
    await advance(code === "CANCELLED" ? "CANCELLED" : "FAILED", { error: code });
  }
  return current;
}
