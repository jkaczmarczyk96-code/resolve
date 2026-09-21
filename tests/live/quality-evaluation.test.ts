import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { canonicalSource, publisherGroup } from "@/lib/ai/quality";
import { createNebiusProvider } from "@/lib/ai/nebius";
import { createTavilyProvider } from "@/lib/ai/research";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { fullStates, parseFullSnapshot, type FullSnapshot } from "@/lib/orchestration/full-state";
import { WorkflowError, type WorkflowStore } from "@/lib/orchestration/state";

if (!process.env.NEBIUS_API_KEY || !process.env.TAVILY_API_KEY) {
  throw new Error("Quality evaluation requires configured Nebius and Tavily API keys.");
}

class EvaluationStore implements WorkflowStore<FullSnapshot> {
  private readonly history: FullSnapshot[] = [];

  constructor(private readonly description: string) {}

  async loadProblem() {
    return { description: this.description };
  }

  async create(value: FullSnapshot) {
    if (this.history.some((item) => item.id === value.id)) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }

  async save(value: FullSnapshot, revision: number) {
    if (this.history.findLast((item) => item.id === value.id)?.revision !== revision) throw new WorkflowError("CONFLICT");
    this.history.push(parseFullSnapshot(value));
  }

  async load(id: string) {
    const value = this.history.findLast((item) => item.id === id);
    if (!value) throw new WorkflowError("NOT_FOUND");
    return parseFullSnapshot(value);
  }
}

interface QualityReport {
  score: number;
  checks: Record<string, boolean>;
  metrics: Record<string, number | string>;
}

function evaluate(snapshot: FullSnapshot): QualityReport {
  if (!snapshot.plan || !snapshot.research || !snapshot.verification || !snapshot.options || !snapshot.critique || !snapshot.decision || !snapshot.tasks) {
    return {
      score: 0,
      checks: { completeOutput: false },
      metrics: {
        state: snapshot.state,
        error: snapshot.error ?? "none",
        lastCompletedStage: snapshot.events.at(-2)?.state ?? "none",
      },
    };
  }

  const questions = snapshot.research.questions ?? [snapshot.research.question];
  const sourceIds = new Set(snapshot.research.sources.map((source) => source.id));
  const canonicalUrls = new Set(snapshot.research.sources.map((source) => canonicalSource(source.url)));
  const publishers = new Set(snapshot.research.sources.map((source) => publisherGroup(source.url)));
  const claimIds = new Set(snapshot.research.output.claims.map((claim) => claim.id));
  const assessedClaims = new Set(snapshot.verification.assessments.map((assessment) => assessment.claimId));
  const supportedClaims = snapshot.verification.assessments.filter((assessment) => assessment.status === "VERIFIED" || assessment.status === "PARTIALLY_VERIFIED");
  const primarySources = snapshot.verification.sourceProfiles?.filter((source) => source.kind === "primary").length ?? 0;
  const critiqueGroups = [
    snapshot.critique.risks,
    snapshot.critique.failureScenarios,
    snapshot.critique.unsupportedAssumptions,
    snapshot.critique.evidenceWeaknesses,
    snapshot.critique.overlookedConstraints,
  ].filter((group) => group.length > 0).length;
  const taskIds = new Set(snapshot.tasks.tasks.map((task) => task.id));
  const taskReferencesValid = snapshot.tasks.tasks.every((task) =>
    task.dependencies.every((dependency) => taskIds.has(dependency)) &&
    (!task.optionId || snapshot.options!.options.some((option) => option.id === task.optionId)) &&
    (!task.planStepId || snapshot.plan!.steps.some((step) => step.id === task.planStepId)),
  );
  const confidenceGuarded = snapshot.decision.confidence !== "high" ||
    (snapshot.decision.unresolvedUnknowns.length === 0 && snapshot.decision.assumptions.length === 0 && supportedClaims.length > 0);

  const checks = {
    completed: snapshot.state === "COMPLETED" && snapshot.events.map((event) => event.state).join("|") === fullStates.join("|"),
    multipleResearchQuestions: questions.length >= 2,
    sufficientSources: snapshot.research.sources.length >= 2,
    canonicalSources: canonicalUrls.size === snapshot.research.sources.length,
    independentPublishers: publishers.size >= 2,
    claimsPresent: claimIds.size > 0,
    everyClaimAssessed: claimIds.size === assessedClaims.size && [...claimIds].every((id) => assessedClaims.has(id)),
    supportedClaimPresent: supportedClaims.length > 0,
    primarySourcePresent: primarySources > 0,
    alternativesCompared: snapshot.options.options.length >= 2,
    meaningfulCritique: critiqueGroups >= 3,
    decisionEvidenceValid: snapshot.decision.supportingEvidence.every((id) => sourceIds.has(id)),
    confidenceGuarded,
    actionableTasks: snapshot.tasks.tasks.length >= 2 && taskReferencesValid,
  };
  const weights: Record<keyof typeof checks, number> = {
    completed: 15,
    multipleResearchQuestions: 5,
    sufficientSources: 10,
    canonicalSources: 5,
    independentPublishers: 10,
    claimsPresent: 5,
    everyClaimAssessed: 10,
    supportedClaimPresent: 10,
    primarySourcePresent: 5,
    alternativesCompared: 5,
    meaningfulCritique: 5,
    decisionEvidenceValid: 5,
    confidenceGuarded: 5,
    actionableTasks: 5,
  };
  const score = Object.entries(checks).reduce((total, [name, passed]) => total + (passed ? weights[name as keyof typeof checks] : 0), 0);

  return {
    score,
    checks,
    metrics: {
      questions: questions.length,
      sources: snapshot.research.sources.length,
      publishers: publishers.size,
      claims: claimIds.size,
      supportedClaims: supportedClaims.length,
      primarySources,
      options: snapshot.options.options.length,
      critiqueGroups,
      tasks: snapshot.tasks.tasks.length,
      confidence: snapshot.decision.confidence,
    },
  };
}

const scenarios = [
  {
    name: "official developer documentation",
    description: "Create a concise implementation checklist for one developer choosing between JSON object output and JSON schema structured output in Nebius Token Factory. Use current official public Nebius documentation, compare reliability and implementation trade-offs, and recommend one approach for a TypeScript prototype. No deployment or external action is needed. Clearly preserve any missing or unverified detail as an uncertainty.",
  },
  {
    name: "time-bounded online meeting",
    description: "I need to organize one two-hour online meeting for four adult friends in the next month. Compare free video-call options using current official provider documentation, especially call-duration and participant limits. Everyone has a laptop and internet. I do not want to buy anything or send messages automatically. Recommend a practical option and give me a short checklist, while marking facts that could not be verified.",
  },
  {
    name: "cross-border relocation checklist",
    description: "I am a Czech EU citizen considering a six-month move to Germany while keeping a remote job. Build a preliminary checklist of the most important registration, health-insurance and tax questions to verify from current official sources. I have not chosen a city or moving date. Do not present legal or tax uncertainty as settled advice, do not contact anyone, and recommend the next safe steps.",
  },
] as const;

it.each(scenarios)("scores the complete $name workflow", async ({ description }) => {
  const result = await runFullWorkflow(
    { runId: randomUUID(), problemId: randomUUID() },
    new EvaluationStore(description),
    { ai: createNebiusProvider(), research: createTavilyProvider() },
  );
  const report = evaluate(result);
  console.info(JSON.stringify(report));
  expect(result.error).toBeNull();
  expect(report.score, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(75);
  expect(report.checks.completed).toBe(true);
  expect(report.checks.everyClaimAssessed).toBe(true);
  expect(report.checks.decisionEvidenceValid).toBe(true);
  expect(report.checks.confidenceGuarded).toBe(true);
  expect(report.checks.actionableTasks).toBe(true);
});
