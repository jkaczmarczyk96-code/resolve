import type { AgentOutput } from "@/lib/ai/schemas";

/** Keep explicit requests for current facts on the evidence path, even if the planner omits queries. */
export function needsExternalEvidence(description: string, intake: AgentOutput<"intake">) {
  const noExternalFacts = /\b(no external research|without web research|no current facts needed)\b|bez (hledání|vyhledávání) (aktuálních|externích)|bez externích zdrojů/i.test(description);
  const highStakesFacts = /\b(medical|treatment|legal|tax|financial|investment|insurance)\b|léčb|lékař|právn|zákon|daň|pojištěn|invest|finanč/i.test(description);
  if (noExternalFacts && intake.category === "other" && !highStakesFacts) return false;
  return ["product", "travel", "relocation"].includes(intake.category)
    || /\b(current|latest|official|documentation|law|legal|tax|medical|health insurance|price|availability|regulation)\b|aktuáln|oficiáln|předpis|zákon|daň|pojištěn|cen[ay]|dostupnost|lékař|léčb/i.test(description);
}

export function ensureResearchQuestions(plan: AgentOutput<"planner">, intake: AgentOutput<"intake">, required: boolean): AgentOutput<"planner"> {
  if (!required || plan.steps.some((step) => step.researchQuestions.length > 0)) return plan;
  const goal = intake.goal.slice(0, 230);
  const title = intake.title.slice(0, 100);
  const fallback = [`${goal} official primary sources`, `${title} official requirements and limits`];
  return { steps: plan.steps.map((step, index) => index === 0 ? { ...step, researchQuestions: fallback } : step) };
}
