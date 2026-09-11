import { z } from "zod";
import { intakeInput, intakeOutput, plannerOutput, decisionOutput } from "@/lib/ai/schemas";
import { validatePlan } from "@/lib/ai/integrity";

export const stateSchema = z.enum(["PENDING", "INTAKE", "PLAN", "DECIDE", "COMPLETED", "FAILED", "CANCELLED"]);
export type WorkflowState = z.infer<typeof stateSchema>;
export const transitions: Record<WorkflowState, readonly WorkflowState[]> = {
  PENDING: ["INTAKE", "FAILED", "CANCELLED"], INTAKE: ["PLAN", "FAILED", "CANCELLED"],
  PLAN: ["DECIDE", "FAILED", "CANCELLED"], DECIDE: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [], FAILED: [], CANCELLED: [],
};
export const snapshotSchema = z.strictObject({
  version: z.literal(1), id: z.uuid(), problemId: z.uuid(), model: z.string().min(1).max(200),
  description: intakeInput.shape.description, state: stateSchema, revision: z.number().int().min(0).max(4),
  intake: intakeOutput.nullable(), plan: plannerOutput.nullable(), decision: decisionOutput.nullable(),
  error: z.enum(["CONFIGURATION", "INVALID_INPUT", "INVALID_OUTPUT", "TIMEOUT", "CANCELLED", "AUTHENTICATION", "RATE_LIMIT", "PROVIDER", "REFUSED", "TRUNCATED"]).nullable(),
  events: z.array(z.strictObject({ state: stateSchema, at: z.iso.datetime() })).min(1).max(5),
}).superRefine((value, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "Invalid workflow checkpoint" });
  if (value.events.length !== value.revision + 1 || value.events[0].state !== "PENDING" || value.events.at(-1)?.state !== value.state) fail();
  for (let i = 1; i < value.events.length; i++) {
    if (!transitions[value.events[i - 1].state].includes(value.events[i].state) || Date.parse(value.events[i].at) < Date.parse(value.events[i - 1].at)) fail();
  }
  const reached = value.events.map((event) => event.state);
  if (Boolean(value.intake) !== reached.includes("PLAN") || Boolean(value.plan) !== reached.includes("DECIDE") || Boolean(value.decision) !== reached.includes("COMPLETED")) fail();
  if ((value.state === "FAILED" || value.state === "CANCELLED") !== Boolean(value.error)) fail();
  if ((value.state === "CANCELLED") !== (value.error === "CANCELLED")) fail();
  if (value.decision && (value.decision.confidence !== "low" || value.decision.supportingEvidence.length > 0)) fail();
  if (value.decision && value.decision.selectedOptionId !== null && value.decision.selectedOptionId !== "proposed-plan") fail();
  if (value.decision && (value.decision.rejectedAlternatives.length > 1 || value.decision.rejectedAlternatives.some((item) => item.optionId !== "proposed-plan" || item.optionId === value.decision?.selectedOptionId))) fail();
  if (value.plan) { try { validatePlan(value.plan); } catch { fail(); } }
});
export type WorkflowSnapshot = z.infer<typeof snapshotSchema>;
export type WorkflowErrorCode = "INVALID_REQUEST" | "AUTHENTICATION" | "NOT_FOUND" | "CONFLICT" | "PERSISTENCE" | "INVALID_CHECKPOINT";
export class WorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode) { super(`Workflow failed: ${code}`); this.name = "WorkflowError"; }
}
export function parseSnapshot(value: unknown): WorkflowSnapshot {
  const result = snapshotSchema.safeParse(value);
  if (!result.success) throw new WorkflowError("INVALID_CHECKPOINT");
  return result.data;
}
export interface WorkflowStore<S = WorkflowSnapshot> {
  loadProblem(id: string): Promise<{ description: string }>;
  create(snapshot: S): Promise<void>;
  save(snapshot: S, expectedRevision: number): Promise<void>;
  load(id: string): Promise<S>;
}
