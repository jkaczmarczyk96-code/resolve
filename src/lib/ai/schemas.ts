import { z } from "zod";

const text = z.string().trim().min(1).max(2000);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const texts = z.array(text).max(30);
const ids = z.array(id).max(30);
export const sourceSchema = z.strictObject({
  id, url: z.url({ protocol: /^https?$/ }).max(2048), title: text,
  content: z.string().min(1).max(8000), retrievedAt: z.iso.datetime(), publishedAt: z.iso.datetime().nullable().optional(),
});
export const sourcesSchema = z.array(sourceSchema).max(10);
export type Source = z.infer<typeof sourceSchema>;
export const intakeInput = z.strictObject({ description: z.string().trim().min(20).max(12000) });
export const intakeOutput = z.strictObject({
  title: text.max(120), goal: text, constraints: texts, knownFacts: texts,
  assumptions: texts, unknowns: texts,
  category: z.enum(["travel", "relocation", "product", "other"]), initialAssessment: text,
});
export const userResponsesSchema = z.array(z.strictObject({ question: text, answer: z.string().trim().min(1).max(1200) })).min(1).max(8);
export const clarifiedProblem = intakeOutput.extend({ userResponses: userResponsesSchema.optional() });
export const plannerInput = z.strictObject({ problem: clarifiedProblem });
export const plannerOutput = z.strictObject({ steps: z.array(z.strictObject({
  id, title: text, description: text, priority: z.enum(["high", "medium", "low"]),
  dependencies: ids, researchQuestions: texts, userQuestions: texts,
})).min(1).max(20) });
export const researchInput = z.strictObject({ question: text });
export const researchOutput = z.strictObject({
  summary: text,
  claims: z.array(z.strictObject({ id, statement: text, sourceIds: ids.min(1) })).max(20),
  limitations: texts,
});
export const verifierInput = z.strictObject({ claims: researchOutput.shape.claims, sources: sourcesSchema });
export const verifierOutput = z.strictObject({ assessments: z.array(z.strictObject({
  claimId: id, status: z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "CONFLICTING"]),
  unmatchedQuoteSourceIds: ids.optional(),
  supportingQuotes: z.array(z.strictObject({ sourceId: id, quote: z.string().trim().min(10).max(800) })).max(10).optional(),
  sourceIds: ids, sourceQuality: text, freshness: text, contradictions: texts, summary: text,
})).max(20), sourceProfiles: z.array(z.strictObject({ sourceId: id, kind: z.enum(["primary", "secondary", "community", "unknown"]), reason: text })).max(10).optional() });
export const optionsSchema = z.array(z.strictObject({ id, title: text, description: text, risks: texts })).max(10);
export const criticInput = z.strictObject({
  problem: clarifiedProblem, plan: plannerOutput, options: optionsSchema,
  sources: sourcesSchema, verification: verifierOutput, claims: researchOutput.shape.claims,
});
export const criticOutput = z.strictObject({
  overlookedConstraints: texts, unsupportedAssumptions: texts, evidenceWeaknesses: texts,
  risks: texts, alternativeSuggestions: texts, failureScenarios: texts, summary: text,
});
export const decisionInput = z.strictObject({
  goal: text, constraints: texts, options: optionsSchema, sources: sourcesSchema,
  claims: researchOutput.shape.claims, verification: verifierOutput, critique: criticOutput.nullable(), risks: texts,
  planningContext: z.strictObject({ problem: clarifiedProblem, plan: plannerOutput }).optional(),
});
export const decisionOutput = z.strictObject({
  recommendation: text, selectedOptionId: id.nullable(),
  confidence: z.enum(["low", "medium", "high"]), reasoningSummary: text,
  supportingEvidence: ids, assumptions: texts, unresolvedUnknowns: texts,
  rejectedAlternatives: z.array(z.strictObject({ optionId: id, reason: text })).max(10),
});
export const optionsInput = z.strictObject({ problem: clarifiedProblem, plan: plannerOutput, sources: sourcesSchema, claims: researchOutput.shape.claims, verification: verifierOutput });
export const optionsOutput = z.strictObject({ options: optionsSchema, limitations: texts });
export const tasksInput = z.strictObject({ problem: clarifiedProblem, plan: plannerOutput, options: optionsSchema, decision: decisionOutput });
export const tasksOutput = z.strictObject({ tasks: z.array(z.strictObject({
  id, title: text, description: text, priority: z.enum(["high", "medium", "low"]),
  dependencies: ids, planStepId: id.nullable(), optionId: id.nullable(), status: z.literal("proposed"),
})).max(20) });

export const contracts = {
  intake: { input: intakeInput, output: intakeOutput },
  planner: { input: plannerInput, output: plannerOutput },
  researcher: { input: researchInput, output: researchOutput },
  verifier: { input: verifierInput, output: verifierOutput },
  critic: { input: criticInput, output: criticOutput },
  decision: { input: decisionInput, output: decisionOutput },
  options: { input: optionsInput, output: optionsOutput },
  tasks: { input: tasksInput, output: tasksOutput },
} as const;
export type AgentName = keyof typeof contracts;
export type AgentInput<N extends AgentName> = z.infer<(typeof contracts)[N]["input"]>;
export type AgentOutput<N extends AgentName> = z.infer<(typeof contracts)[N]["output"]>;
