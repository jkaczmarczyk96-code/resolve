import "server-only";
import { z } from "zod";
import { intake, planner, decision, type AgentDependencies } from "@/lib/ai/agents";
import { AIError } from "@/lib/ai/errors";
import { intakeInput, type AgentInput } from "@/lib/ai/schemas";
import { parseSnapshot, transitions, WorkflowError, type WorkflowSnapshot, type WorkflowStore, type WorkflowState } from "./state";

const requestSchema = z.strictObject({ runId: z.uuid(), problemId: z.uuid() });
export type BasicRequest = z.infer<typeof requestSchema>;
export function basicDecisionInput(snapshot: WorkflowSnapshot): AgentInput<"decision"> {
  if (!snapshot.intake || !snapshot.plan) throw new WorkflowError("INVALID_CHECKPOINT");
  return {
    goal: snapshot.intake.goal, constraints: snapshot.intake.constraints,
    planningContext: { problem: snapshot.intake, plan: snapshot.plan },
    options: [{ id: "proposed-plan", title: "Investigate the proposed plan", description: "Evaluate the ordered steps in planningContext. This is a proposed course of work, not a verified solution or a completed action.", risks: ["Research, verification, and independent critique have not run."] }],
    sources: [], claims: [], verification: { assessments: [] }, critique: null,
    risks: ["Evidence is absent. Availability, costs, and feasibility have not been independently checked."],
  };
}

/** A single finite run: three validated agent calls, checkpointed before each call. */
export async function runBasicWorkflow(raw: BasicRequest, store: WorkflowStore, deps: AgentDependencies, options: { signal?: AbortSignal } = {}): Promise<WorkflowSnapshot> {
  const request = requestSchema.safeParse(raw);
  if (!request.success) throw new WorkflowError("INVALID_REQUEST");
  if (options.signal?.aborted) throw new AIError("CANCELLED");
  const durable = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); }
    catch (error) { throw error instanceof WorkflowError ? error : new WorkflowError("PERSISTENCE"); }
  };
  const problem = await durable(() => store.loadProblem(request.data.problemId));
  const input = intakeInput.safeParse({ description: problem.description });
  if (!input.success) throw new AIError("INVALID_INPUT");
  let current = parseSnapshot({
    version: 1, id: request.data.runId, problemId: request.data.problemId, description: input.data.description,
    model: deps.ai.model, state: "PENDING", revision: 0, intake: null, plan: null, decision: null, error: null,
    events: [{ state: "PENDING", at: new Date().toISOString() }],
  });
  await durable(() => store.create(current)); // Duplicate run IDs stop here, before any paid call.
  const advance = async (state: WorkflowState, patch: Partial<Pick<WorkflowSnapshot, "intake" | "plan" | "decision" | "error">> = {}) => {
    if (state !== "FAILED" && state !== "CANCELLED" && options.signal?.aborted) throw new AIError("CANCELLED");
    if (!transitions[current.state].includes(state)) throw new WorkflowError("INVALID_CHECKPOINT");
    const next = parseSnapshot({ ...current, ...patch, state, revision: current.revision + 1, events: [...current.events, { state, at: new Date(Math.max(Date.now(), Date.parse(current.events.at(-1)!.at))).toISOString() }] });
    await durable(() => store.save(next, current.revision));
    current = next; // Advance locally only after the durable compare-and-swap succeeds.
  };
  try {
    await advance("INTAKE");
    const understood = await intake(input.data, deps, options);
    await advance("PLAN", { intake: understood.output });
    const planned = await planner({ problem: understood.output }, deps, options);
    await advance("DECIDE", { plan: planned.output });
    const decided = await decision(basicDecisionInput(current), deps, options);
    // No research/verification ran: confidence is an application policy, not an LLM score.
    await advance("COMPLETED", { decision: { ...decided.output, confidence: "low" } });
  } catch (error) {
    // A failed/ambiguous write must never be followed by another write or another model call.
    if (error instanceof WorkflowError) throw error;
    const code = error instanceof AIError ? error.code : "PROVIDER";
    await advance(code === "CANCELLED" ? "CANCELLED" : "FAILED", { error: code });
  }
  return current;
}
