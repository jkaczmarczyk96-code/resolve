import { z } from "zod";
import { evidenceQuality } from "@/lib/ai/quality";
import { snapshotSchema, WorkflowError } from "./state";
import { researchOutput, sourcesSchema, verifierOutput, optionsOutput, criticOutput, tasksOutput, userResponsesSchema, type AgentInput, type AgentOutput } from "@/lib/ai/schemas";
import { validateInput, validateOutput } from "@/lib/ai/integrity";

export const fullStates = ["PENDING", "INTAKE", "PLAN", "RESEARCH", "VERIFY", "OPTIONS", "CRITIQUE", "DECIDE", "TASKS", "COMPLETED"] as const;
export const fullStateSchema = z.enum([...fullStates, "ACTION_REQUIRED", "RESUME", "FAILED", "CANCELLED"]);
export type FullState = z.infer<typeof fullStateSchema>;
export function canAdvance(from: FullState, to: FullState) {
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(from)) return false;
  if (from === "ACTION_REQUIRED") return ["RESUME", "FAILED", "CANCELLED"].includes(to);
  if (from === "RESUME") return ["RESEARCH", "FAILED", "CANCELLED"].includes(to);
  if (from === "RESEARCH" && to === "ACTION_REQUIRED") return true;
  const index = fullStates.findIndex((state) => state === from);
  return to === "FAILED" || to === "CANCELLED" || fullStates[index + 1] === to;
}
const base = z.strictObject({
  qualityPolicy: z.union([z.literal(1), z.literal(2)]).optional(),
  outcomePolicy: z.literal(1).optional(),
  ...snapshotSchema.shape, version: z.literal(2), state: fullStateSchema, revision: z.number().int().min(0).max(12),
  events: z.array(z.strictObject({ state: fullStateSchema, at: z.iso.datetime() })).min(1).max(13),
  human: z.strictObject({ questions: z.array(z.string().trim().min(1).max(2000)).min(1).max(8), responseId: z.uuid().nullable(), responses: userResponsesSchema.nullable() }).optional(),
  research: z.strictObject({ question: z.string().min(1).max(2000), questions: z.array(z.string().trim().min(1).max(2000)).min(1).max(3).optional(), output: researchOutput, sources: sourcesSchema }).nullable(),
  verification: verifierOutput.nullable(), options: optionsOutput.nullable(), critique: criticOutput.nullable(), tasks: tasksOutput.nullable(),
});
export type FullSnapshot = z.infer<typeof base>;
function required<T>(value: T | null): T { if (value === null) throw new WorkflowError("INVALID_CHECKPOINT"); return value; }
export function fullProblem(s: FullSnapshot): AgentInput<"planner">["problem"] {
  return { ...required(s.intake), originalRequest: s.description, ...(s.human?.responses ? { userResponses: s.human.responses } : {}) };
}
export function fullOptionsInput(s: FullSnapshot): AgentInput<"options"> {
  const research = required(s.research);
  return { problem: fullProblem(s), plan: required(s.plan), sources: research.sources, claims: research.output.claims, verification: required(s.verification) };
}
export function fullCriticInput(s: FullSnapshot): AgentInput<"critic"> {
  return { ...fullOptionsInput(s), options: required(s.options).options };
}
export function fullDecisionInput(s: FullSnapshot): AgentInput<"decision"> {
  const context = fullCriticInput(s);
  const planned=[...new Set(context.plan.steps.flatMap((step)=>step.researchQuestions))];
  const researched=s.research?.questions?.length ?? (s.research ? 1 : 0);
  const coverage=planned.length>researched ? [`Research covered ${researched} of ${planned.length} planned questions; the remaining questions still require review.`] : [];
  return { goal: context.problem.goal, constraints: context.problem.constraints, options: context.options,
    sources: context.sources, claims: context.claims, verification: context.verification, critique: required(s.critique),
    risks: [...coverage, ...required(s.critique).risks].slice(0, 30), planningContext: { problem: context.problem, plan: context.plan },
  };
}
export function fullTasksInput(s: FullSnapshot): AgentInput<"tasks"> {
  return { problem: fullProblem(s), plan: required(s.plan), options: required(s.options).options, decision: required(s.decision),
    evidenceGaps: required(s.research).output.limitations };
}
/** Preserve a concrete, limited path when an unresolved task response is malformed. */
export function fallbackUnresolvedPlan(s: FullSnapshot, language: "cs" | "en"): AgentOutput<"tasks"> {
  const questions = s.plan?.steps.flatMap((step) => [...step.researchQuestions, ...step.userQuestions]) ?? [];
  const gaps = [...new Set([...questions, ...(s.decision?.unresolvedUnknowns ?? []), ...(s.research?.output.limitations ?? [])])].filter(Boolean).slice(0, 3);
  const checks = gaps.length ? gaps : [s.plan?.steps[0]?.description ?? s.intake?.goal ?? s.description];
  const intro = language === "cs"
    ? "Konečné řešení teď nelze bezpečně potvrdit. Podle dosavadního zadání je potřeba ověřit tyto konkrétní body:"
    : "A final solution cannot yet be confirmed safely. Based on the request, verify these specific points:";
  return {
    solution: { title: language === "cs" ? "Postup k dokončení řešení" : "Path to a solution",
      content: `${intro}\n${checks.map((item, index) => `${index + 1}. ${item.slice(0, 1900)}`).join("\n")}\n${language === "cs" ? "Po ověření pokračujte v rozhodnutí podle zjištěných údajů; nepovažujte neověřené údaje za potvrzené." : "Continue the decision with the verified details; do not treat unverified facts as confirmed."}` },
    tasks: checks.map((item, index) => ({ id: `verify-${index + 1}`, title: `${language === "cs" ? "Ověřit" : "Verify"}: ${item.slice(0, 120)}`,
      description: item.slice(0, 1900), priority: "high", dependencies: [], planStepId: null, optionId: null, status: "proposed" })),
  };
}
function hasGroundedSupport(s: FullSnapshot) {
  return (s.verification?.assessments ?? []).some((assessment) =>
    (assessment.status === "VERIFIED" || assessment.status === "PARTIALLY_VERIFIED") &&
    Boolean(assessment.supportingQuotes?.some((quote) => assessment.sourceIds.includes(quote.sourceId))),
  );
}
/** A plan drawn only from the user's own constraints can be useful without web citations. */
function isSourceFreePlan(s: FullSnapshot) {
  return Boolean(s.plan && s.plan.steps.every((step) => step.researchQuestions.length === 0)
    && s.research && s.research.sources.length === 0 && s.research.output.claims.length === 0);
}
/** Require traceable evidence for external claims; allow source-free draft plans. */
export function guardDecisionEvidence(s: FullSnapshot, decision: NonNullable<FullSnapshot["decision"]>): NonNullable<FullSnapshot["decision"]> {
  if (s.qualityPolicy !== 2 || hasGroundedSupport(s) || isSourceFreePlan(s) || decision.selectedOptionId === null) return decision;
  const reason = "No option can be recommended yet because the saved evidence contains no traceable verified supporting excerpt.";
  return {
    ...decision,
    recommendation: `${reason} Review the sources or start a focused follow-up analysis.`,
    selectedOptionId: null,
    confidence: "low",
    reasoningSummary: reason,
    supportingEvidence: [],
    unresolvedUnknowns: [...new Set([...decision.unresolvedUnknowns, "At least one decision-relevant claim needs a traceable verified supporting excerpt."])],
    rejectedAlternatives: (s.options?.options ?? []).map((option) => ({ optionId: option.id, reason })),
  };
}
/** Conservative cap until the dedicated evidence-quality phase; never raises the model rating. */
export function fullConfidence(s: FullSnapshot, decision: NonNullable<FullSnapshot["decision"]>): "low" | "medium" {
  if (s.qualityPolicy === 1) {
    const at = s.events.find((event) => event.state === "DECIDE")?.at ?? s.events.at(-1)!.at;
    return decision.confidence === "low" ? "low" : evidenceQuality(s, decision, at).maxConfidence;
  }
  const verified = s.verification?.assessments ?? [];
  const sources = s.research?.sources ?? [];
  const supporting = sources.filter((source) => decision.supportingEvidence.includes(source.id));
  const domains = new Set(supporting.map((source) => new URL(source.url).hostname));
  const unknown = (s.intake?.unknowns.length ?? 0) + (s.intake?.assumptions.length ?? 0) + decision.assumptions.length + decision.unresolvedUnknowns.length;
  const objections = s.critique ? s.critique.evidenceWeaknesses.length + s.critique.risks.length + s.critique.overlookedConstraints.length + s.critique.unsupportedAssumptions.length : 1;
  const plannedQuestions=new Set(s.plan?.steps.flatMap((step)=>step.researchQuestions)??[]).size;
  const researchedQuestions=s.research?.questions?.length ?? (s.research ? 1 : 0);
  const remaining = plannedQuestions > researchedQuestions || (s.research?.output.limitations.length ?? 0) > 0 || (s.options?.limitations.length ?? 0) > 0;
  if (decision.confidence === "low" || !decision.selectedOptionId || unknown || objections || remaining || domains.size < 2 || !verified.length || verified.some((item) => item.status !== "VERIFIED") || decision.supportingEvidence.some((id) => !verified.some((item) => item.sourceIds.includes(id)))) return "low";
  return "medium";
}
export const fullSnapshotSchema = base.superRefine((s, ctx) => {
  const fail = () => ctx.addIssue({ code: "custom", message: "Invalid full workflow checkpoint" });
  if (s.events.length !== s.revision + 1 || s.events[0].state !== "PENDING" || s.events.at(-1)?.state !== s.state) fail();
  for (let i = 1; i < s.events.length; i++) if (!canAdvance(s.events[i - 1].state, s.events[i].state) || Date.parse(s.events[i].at) < Date.parse(s.events[i - 1].at)) fail();
  const reached = s.events.map((event) => event.state);
  const pauses = reached.filter((state) => state === "ACTION_REQUIRED").length;
  const resumed = reached.includes("RESUME");
  if (pauses > 1 || Boolean(s.human) !== (pauses === 1)) fail();
  if (s.human && (Boolean(s.human.responses) !== resumed || Boolean(s.human.responseId) !== resumed)) fail();
  if (s.human?.responses && (s.human.responses.length !== s.human.questions.length || s.human.responses.some((item, index) => item.question !== s.human!.questions[index]))) fail();
  const fields = { intake: "PLAN", plan: "RESEARCH", research: "VERIFY", verification: "OPTIONS", options: "CRITIQUE", critique: "DECIDE", decision: "TASKS", tasks: "COMPLETED" } as const;
  for (const [field, state] of Object.entries(fields)) if (Boolean(s[field as keyof typeof fields]) !== reached.includes(state)) fail();
  if ((s.state === "FAILED" || s.state === "CANCELLED") !== Boolean(s.error) || (s.state === "CANCELLED") !== (s.error === "CANCELLED")) fail();
  try {
    if (s.plan) validateOutput("planner", { problem: s.intake }, s.plan, []);
    if (s.research) validateOutput("researcher", { question: s.research.question }, s.research.output, s.research.sources);
    if (s.verification) validateOutput("verifier", { claims: required(s.research).output.claims, sources: required(s.research).sources }, s.verification, []);
    if (s.options) { validateInput("options", fullOptionsInput(s)); validateOutput("options", fullOptionsInput(s), s.options, []); }
    if (s.critique) validateInput("critic", fullCriticInput(s));
    if (s.decision) {
      validateInput("decision", fullDecisionInput(s)); validateOutput("decision", fullDecisionInput(s), s.decision, []);
      if (s.decision.confidence !== fullConfidence(s, s.decision)) fail();
      if (s.qualityPolicy === 2 && !hasGroundedSupport(s) && !isSourceFreePlan(s) && s.decision.selectedOptionId !== null) fail();
    }
    if (s.tasks) { validateInput("tasks", fullTasksInput(s)); validateOutput("tasks", fullTasksInput(s), s.tasks, [], s.outcomePolicy === 1); }
  } catch { fail(); }
});
export function parseFullSnapshot(value: unknown): FullSnapshot {
  const result = fullSnapshotSchema.safeParse(value);
  if (!result.success) throw new WorkflowError("INVALID_CHECKPOINT");
  return result.data;
}
