import { AIError } from "./errors";
import { optionsInput, optionsOutput, tasksInput, tasksOutput } from "./schemas";
import { type AgentName, type Source, plannerOutput, researchOutput, verifierInput, verifierOutput, criticInput, decisionInput, decisionOutput } from "./schemas";

function assert(ok: boolean, input = false): asserts ok {
  if (!ok) throw new AIError(input ? "INVALID_INPUT" : "INVALID_OUTPUT");
}
function unique(values: string[], input = false) { assert(new Set(values).size === values.length, input); }
function references(values: string[], allowed: string[], input = false) {
  unique(values, input);
  assert(values.every((value) => allowed.includes(value)), input);
}
export function validatePlan(value: unknown, input = false) {
  const { steps } = plannerOutput.parse(value);
  const ids = steps.map((step) => step.id);
  unique(ids, input);
  for (const step of steps) references(step.dependencies, ids.filter((id) => id !== step.id), input);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    assert(!visiting.has(id), input);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of steps.find((step) => step.id === id)!.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  ids.forEach(visit);
}
export function validateSources(sources: Source[], input = false) {
  unique(sources.map((source) => source.id), input);
  unique(sources.map((source) => source.url), input);
  assert(sources.every((source) => { const url = new URL(source.url); return !url.username && !url.password; }), input);
}
function validateEvidence(value: { claims: ReturnType<typeof researchOutput.parse>["claims"]; sources: Source[] }, input: boolean) {
  validateSources(value.sources, input);
  unique(value.claims.map((claim) => claim.id), input);
  for (const claim of value.claims) references(claim.sourceIds, value.sources.map((source) => source.id), input);
}
function validateVerification(value: ReturnType<typeof verifierOutput.parse>, evidence: ReturnType<typeof verifierInput.parse>, input: boolean) {
  references(value.assessments.map((item) => item.claimId), evidence.claims.map((claim) => claim.id), input);
  assert(value.assessments.length === evidence.claims.length, input);
  if (value.sourceProfiles) {
    references(value.sourceProfiles.map((profile) => profile.sourceId), evidence.sources.map((source) => source.id), input);
    assert(value.sourceProfiles.length === evidence.sources.length, input);
  }
  for (const item of value.assessments) {
    references(item.unmatchedQuoteSourceIds ?? [], item.sourceIds, input);
    assert(!item.unmatchedQuoteSourceIds?.length || item.status !== "VERIFIED", input);
    for (const quote of item.supportingQuotes ?? []) {
      assert(item.sourceIds.includes(quote.sourceId), input);
      const source = evidence.sources.find((source) => source.id === quote.sourceId);
      const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
      assert(Boolean(source && normalize(source.content).includes(normalize(quote.quote))), input);
    }
    references(item.sourceIds, evidence.sources.map((source) => source.id), input);
    assert(item.status === "UNVERIFIED" || item.sourceIds.length > 0, input);
    assert(item.status !== "CONFLICTING" || (item.sourceIds.length > 1 && item.contradictions.length > 0), input);
    assert(item.status !== "VERIFIED" || item.contradictions.length === 0, input);
  }
}
export function validateInput(name: AgentName, input: unknown) {
  if (name === "options") {
    const value = optionsInput.parse(input);
    validateEvidence(value, true); validateVerification(value.verification, value, true); validatePlan(value.plan, true);
  }
  if (name === "tasks") {
    const value = tasksInput.parse(input);
    validatePlan(value.plan, true); unique(value.options.map((item) => item.id), true);
    assert(value.decision.selectedOptionId === null || value.options.some((item) => item.id === value.decision.selectedOptionId), true);
  }
  if (name === "verifier") validateEvidence(verifierInput.parse(input), true);
  if (name === "critic" || name === "decision") {
    const value = name === "critic" ? criticInput.parse(input) : decisionInput.parse(input);
    validateEvidence(value, true);
    unique(value.options.map((option) => option.id), true);
    validateVerification(value.verification, value, true);
    if ("plan" in value) validatePlan(value.plan, true);
    if ("planningContext" in value && value.planningContext) validatePlan(value.planningContext.plan, true);
  }
}
export function validateOutput(name: AgentName, input: unknown, output: unknown, sources: Source[], requireOutcome = true) {
  if (name === "options") unique(optionsOutput.parse(output).options.map((item) => item.id));
  if (name === "tasks") {
    const context = tasksInput.parse(input);
    const { tasks, solution } = tasksOutput.parse(output);
    if (requireOutcome && context.problem.requestedOutcome) {
      assert(Boolean(solution));
      if (context.decision.selectedOptionId === null && context.plan.steps.some((step) => step.researchQuestions.length > 0)) assert(tasks.length > 0);
      if (solution) {
        if (/\b(?:3\s*(?:h|hodin(?:y|u)?)|180\s*min)\b/i.test(context.problem.originalRequest ?? "")) {
          assert(!/(?:3\s*(?:h|hodin(?:y|u)?)|180\s*min)[^\n.]{0,180}\b(?:plus|navíc|additional)\s*\d+\s*min/i.test(solution.content));
        }
        // Catch schedules that visibly promise less time than their listed blocks.
        // Other formats remain the model's responsibility rather than guessing durations.
        for (const day of solution.content.matchAll(/(?:Den|Day)\s+\d+[^:]{0,80}:\s*(\d+)\s*min\s*[–-]\s*([\s\S]*?)(?=(?:Den|Day)\s+\d+|$)/gi)) {
          const available = Number(day[1]);
          const allocated = [...day[2].matchAll(/\b(?:(\d+)\s*[×x]\s*)?(\d+)\s*min\b/gi)]
            .reduce((total, block) => total + Number(block[1] ?? 1) * Number(block[2]), 0);
          assert(allocated <= available);
        }
        const weeklySteps = context.plan.steps.map((step) => step.title.match(/(?:week|týden)\s*(\d+)/i)?.[1]).filter((value): value is string => Boolean(value));
        if (weeklySteps.length >= 2) {
          for (const week of new Set(weeklySteps)) assert(new RegExp(`(?:week|týden)\\s*${week}\\b|\\b${week}\\.?\\s*(?:week|týden)\\b`, "i").test(solution.content));
        }
      }
    }
    if (tasks.length) validatePlan({ steps: tasks.map((item) => ({ id: item.id, title: item.title, description: item.description, priority: item.priority, dependencies: item.dependencies, researchQuestions: [], userQuestions: [] })) });
    for (const task of tasks) {
      assert(task.planStepId === null || context.plan.steps.some((step) => step.id === task.planStepId));
      assert(task.optionId === null || task.optionId === context.decision.selectedOptionId);
    }
  }
  if (name === "planner") validatePlan(output);
  if (name === "researcher") validateEvidence({ ...researchOutput.parse(output), sources }, false);
  if (name === "verifier") validateVerification(verifierOutput.parse(output), verifierInput.parse(input), false);
  if (name === "decision") {
    const result = decisionOutput.parse(output);
    const context = decisionInput.parse(input);
    references(result.supportingEvidence, context.sources.map((source) => source.id));
    assert(result.selectedOptionId === null || context.options.some((option) => option.id === result.selectedOptionId));
    references(result.rejectedAlternatives.map((item) => item.optionId), context.options.map((option) => option.id).filter((id) => id !== result.selectedOptionId));
    if (result.confidence === "high") {
      const verified = context.verification.assessments.filter((item) => item.status === "VERIFIED").flatMap((item) => item.sourceIds);
      assert(result.selectedOptionId !== null && result.supportingEvidence.length > 0 && result.supportingEvidence.every((id) => verified.includes(id)) && result.assumptions.length === 0 && result.unresolvedUnknowns.length === 0);
    }
  }
}

/** A source-free answer may be useful, but the model cannot award it evidence-grade confidence. */
export function normalizeSourceFreeDecision(input: ReturnType<typeof decisionInput.parse>, output: ReturnType<typeof decisionOutput.parse>) {
  if (input.sources.length) return output;
  const allowedAlternatives = new Set(input.options.map((option) => option.id).filter((id) => id !== output.selectedOptionId));
  return { ...output,
    confidence: output.confidence === "high" ? "low" as const : output.confidence,
    supportingEvidence: [],
    rejectedAlternatives: output.rejectedAlternatives.filter((item) => allowedAlternatives.has(item.optionId)),
  };
}

/** Decode common model-produced newline escapes before the result reaches the UI. */
export function normalizeSolutionFormatting(output: ReturnType<typeof tasksOutput.parse>, input?: ReturnType<typeof tasksInput.parse>) {
  if (!output.solution) return output;
  const email = /\b(?:e[‑-]?mail|email)\b/i.test(input?.problem.originalRequest ?? "");
  let content = output.solution.content
    .replace(/~n~?/g, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/&#(?:10|x0?a);/gi, "\n")
    .replace(/%n/g, "\n")
    .replace(/¶n/g, "\n")
    .replace(/\\n(?=\s*(?:\d+[.)]|[-•]))/g, "\n")
    .replace(/\/n(?=\s*\d+[.)])/g, "\n")
    .replace(/([.!?])\s+(?=(?:-\s+|\d+[.)]\s+))/g, "$1\n");
  if (email) content = content
    .replace(/\/n/g, "\n")
    .replace(/\/\s*(?=(?:S pozdravem|S úctou|Kind regards|Best regards|Regards|Thank you|Děkuji)[,\s])/gi, "\n")
    .replace(/((?:S pozdravem|S úctou|Kind regards|Best regards|Regards|Thank you|Děkuji)),?\s*\/\s*(?=\p{Lu})/giu, "$1,\n")
    .replace(/(?<=[\p{Ll}.,:])n{1,2}(?=\p{Lu})/gu, "\n")
    .replace(/\s+nn(?=\p{Ll})/gu, "\n")
    .replace(/\s+n(?=\p{Lu})/gu, "\n")
    .replace(/([,.:;])n(?=[\p{Ll}])/gu, "$1\n");
  const request = input?.problem.originalRequest ?? "";
  if (/(?:^|\s)(?:tři|tří|3|three)\s+(?:body|bodů|points|items)(?=\s|[.,!?]|$)/i.test(request)
    && !/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s/m.test(content)) {
    const sentences = content.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u).map((item) => item.trim()).filter(Boolean);
    if (sentences.length === 3) content = sentences.map((item) => `- ${item}`).join("\n");
  }
  return { ...output, solution: { ...output.solution, content } };
}

/** Discard non-verbatim model quotes, retain an audit marker and lower their claim status. */
export function groundVerification(value: ReturnType<typeof verifierOutput.parse>, evidence: ReturnType<typeof verifierInput.parse>) {
  return { ...value, assessments: value.assessments.map((item) => {
    const rejected: string[] = [];
    const quotes = item.supportingQuotes?.filter((quote) => {
      const source = evidence.sources.find((source) => source.id === quote.sourceId);
      // Foreign IDs remain errors for the integrity validator, never silently repaired.
      if (!source || !item.sourceIds.includes(quote.sourceId)) return true;
      const norm = (text: string) => text.replace(/\s+/g, " ").trim();
      if (norm(source.content).includes(norm(quote.quote))) return true;
      rejected.push(quote.sourceId); return false;
    });
    const missingQuote = (item.status === "VERIFIED" || item.status === "PARTIALLY_VERIFIED")
      && (item.supportingQuotes?.length ?? 0) === 0;
    const { unmatchedQuoteSourceIds: _ignored, ...original } = item;
    void _ignored;
    return { ...original, ...(quotes ? { supportingQuotes: quotes } : {}), ...(rejected.length ? {
      unmatchedQuoteSourceIds: [...new Set(rejected)],
      status: item.status === "CONFLICTING" ? "CONFLICTING" as const : "UNVERIFIED" as const,
      summary: "One or more model-provided quotations did not match the retrieved content and were discarded. Review the evidence before relying on this claim.",
    } : missingQuote ? {
      status: "UNVERIFIED" as const,
      summary: "The model did not provide a traceable supporting excerpt, so this claim remains unverified.",
    } : {}) };
  }) };
}
