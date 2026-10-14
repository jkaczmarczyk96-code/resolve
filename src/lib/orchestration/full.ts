import "server-only";
import { z } from "zod";
import { runAgent, type AgentDependencies } from "@/lib/ai/agents";
import { AIError } from "@/lib/ai/errors";
import { intakeInput, type AgentOutput } from "@/lib/ai/schemas";
import { searchMany } from "@/lib/ai/research";
import { ensureResearchQuestions, needsExternalEvidence } from "./research-policy";
import { WorkflowError, type WorkflowStore } from "./state";
import { canAdvance, parseFullSnapshot, fullProblem, fullOptionsInput, fullCriticInput, fullDecisionInput, fullTasksInput, fullConfidence, guardDecisionEvidence, fallbackUnresolvedPlan, type FullState, type FullSnapshot } from "./full-state";
import type { BasicRequest } from "./basic";

export async function runFullWorkflow(raw: BasicRequest, store: WorkflowStore<FullSnapshot>, deps: AgentDependencies, options: { signal?: AbortSignal; humanInput?: boolean; recover?: boolean; preserveInterrupt?: boolean; resume?: { responseId: string; answers: string[] } } = {}): Promise<FullSnapshot> {
  const request = z.strictObject({ runId: z.uuid(), problemId: z.uuid() }).safeParse(raw);
  if (!request.success) throw new WorkflowError("INVALID_REQUEST");
  if (options.signal?.aborted) throw new AIError("CANCELLED");
  const durable = async <T>(work: () => Promise<T>): Promise<T> => {
    try { return await work(); } catch (error) { throw error instanceof WorkflowError ? error : new WorkflowError("PERSISTENCE"); }
  };
  const problem = await durable(() => store.loadProblem(request.data.problemId));
  const input = intakeInput.safeParse({ description: problem.description });
  if (!input.success) throw new AIError("INVALID_INPUT");
  const agentOptions = { ...options, responseLanguage: /[ěščřžýáíéúůďťň]|\b(chci|potrebuji|prosim|vybrat|najdi|porovnej|jaky|ktery)\b/i.test(problem.description) ? "cs" as const : "en" as const };
  let current = options.resume || options.recover ? parseFullSnapshot(await durable(() => store.load(request.data.runId))) : parseFullSnapshot({ qualityPolicy: 2, outcomePolicy: 1, version: 2, id: request.data.runId, problemId: request.data.problemId, description: input.data.description,
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
      const researchRequired = needsExternalEvidence(problem.description, current.intake!);
      const replanned = await runAgent("planner", { problem: fullProblem(current) }, deps, { ...agentOptions, researchRequired });
      // One durable clarification has already happened. Further questions belong in
      // the decision's unresolved unknowns, not in another unanswered plan form.
      const plan = ensureResearchQuestions(replanned.output, current.intake!, researchRequired, problem.description);
      await advance("RESEARCH", { plan: { steps: plan.steps.map((step) => ({ ...step, userQuestions: [] })) } });
    }
    if (current.state === "PENDING") {
      await advance("INTAKE");
    }
    if (current.state === "INTAKE") {
      const understood = await runAgent("intake", input.data, deps, agentOptions);
      // Older checkpoints may omit this field, but every new run needs an
      // explicit outcome contract so the final stage cannot return tasks alone.
      const requestedOutcome = understood.output.requestedOutcome ?? input.data.description.slice(0, 2000);
      await advance("PLAN", { intake: { ...understood.output, requestedOutcome } });
    }
    if (current.state === "PLAN") {
      const researchRequired = needsExternalEvidence(problem.description, current.intake!);
      const planned = await runAgent("planner", { problem: fullProblem(current) }, deps, { ...agentOptions, researchRequired });
      await advance("RESEARCH", { plan: ensureResearchQuestions(planned.output, current.intake!, researchRequired, problem.description) });
    }
    if (current.state === "RESEARCH") {
      if (options.humanInput && !current.human) {
        const priority = { high: 0, medium: 1, low: 2 };
        const questions = [...new Map([...current.plan!.steps]
          .sort((a, b) => priority[a.priority] - priority[b.priority])
          .flatMap((step) => step.userQuestions)
          .map((question) => [question.trim().toLocaleLowerCase(), question] as const)).values()].slice(0, 3);
        if (questions.length) {
          await advance("ACTION_REQUIRED", { human: { questions, responseId: null, responses: null } });
          return current;
        }
      }
      // Research at most three distinct, highest-priority questions without adding model calls.
      const priority = { high: 0, medium: 1, low: 2 };
      const planned=[...current.plan!.steps].sort((a,b)=>priority[a.priority]-priority[b.priority]).flatMap((step)=>step.researchQuestions);
      const questions=[...new Set(planned)].slice(0,3);
      if (!questions.length) {
        await advance("VERIFY", { research: {
          question: current.intake!.goal,
          output: { summary: agentOptions.responseLanguage === "cs"
            ? "Pro tento návrh nebylo potřeba vyhledávat externí fakta. Plán vychází z údajů uživatele a je určen k jeho posouzení."
            : "No external facts were needed for this draft plan. It is based on the user's description and should be reviewed before use.", claims: [], limitations: [] },
          sources: [],
        } });
      } else {
        if (!deps.research) throw new AIError("CONFIGURATION");
        const question=questions.length===1 ? questions[0] : questions.map((item,index)=>`${index+1}. ${item.slice(0,620)}`).join("\n");
        const researched=await runAgent("researcher",{ question },{ ...deps,research:{ search:(_combined,signal)=>searchMany(deps.research!,questions,signal) } },agentOptions);
        await advance("VERIFY",{ research:{ question,questions,output:researched.output,sources:researched.sources } });
      }
    }
    if (current.state === "VERIFY") {
      const evidence = { claims: current.research!.output.claims, sources: current.research!.sources };
      let verification: AgentOutput<"verifier">;
      if (!evidence.claims.length && !evidence.sources.length) {
        verification = { assessments: [], sourceProfiles: [] };
      } else try {
        verification = (await runAgent("verifier", evidence, deps, agentOptions)).output;
      } catch (error) {
        if (!(error instanceof AIError) || error.code !== "INVALID_OUTPUT") throw error;
        // A malformed model assessment must never turn retrieved claims into verified facts.
        verification = {
          assessments: evidence.claims.map((claim) => ({
            claimId: claim.id, status: "UNVERIFIED", sourceIds: claim.sourceIds,
            supportingQuotes: [], sourceQuality: "Not assessed", freshness: "Not assessed", contradictions: [],
            summary: "Automated evidence verification failed validation. Review this claim and its sources before relying on it.",
          })),
          sourceProfiles: evidence.sources.map((source) => ({ sourceId: source.id, kind: "unknown", reason: "Automated source assessment failed validation." })),
        };
      }
      await advance("OPTIONS", { verification });
    }
    if (current.state === "OPTIONS") {
      const candidates = await runAgent("options", fullOptionsInput(current), deps, agentOptions);
      await advance("CRITIQUE", { options: candidates.output });
    }
    if (current.state === "CRITIQUE") {
      const critiqued = await runAgent("critic", fullCriticInput(current), deps, agentOptions);
      await advance("DECIDE", { critique: critiqued.output });
    }
    if (current.state === "DECIDE") {
      const decided = await runAgent("decision", fullDecisionInput(current), deps, agentOptions);
      const guarded = guardDecisionEvidence(current, decided.output);
      await advance("TASKS", { decision: { ...guarded, confidence: fullConfidence(current, guarded) } });
    }
    if (current.state === "TASKS") {
      let tasks: AgentOutput<"tasks">;
      try { tasks = (await runAgent("tasks", fullTasksInput(current), deps, agentOptions)).output; }
      catch (error) {
        if (!(error instanceof AIError) || error.code !== "INVALID_OUTPUT" || current.decision?.selectedOptionId !== null) throw error;
        tasks = fallbackUnresolvedPlan(current, agentOptions.responseLanguage);
      }
      await advance("COMPLETED", { tasks });
    }
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    const code = error instanceof AIError ? error.code : "PROVIDER";
    if (options.preserveInterrupt && (code === "CANCELLED" || code === "TIMEOUT")) throw error;
    await advance(code === "CANCELLED" ? "CANCELLED" : "FAILED", { error: code });
  }
  return current;
}
