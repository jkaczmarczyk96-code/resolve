import type { AgentOutput } from "@/lib/ai/schemas";

function declinesExternalResearch(description: string) {
  return /\b(no external research|without web research|no current facts needed|without online search)\b|bez (?:hledání|vyhledávání)(?: (?:aktuálních|externích|na webu))?|bez externích zdrojů|nepotřebuji.{0,60}(?:vyhledáv|hledat|web|externí zdroj)/i.test(description);
}

/** Keep explicit requests for current facts on the evidence path, even if the planner omits queries. */
export function needsExternalEvidence(description: string, intake: AgentOutput<"intake">) {
  const noExternalFacts = declinesExternalResearch(description);
  const requestedFacts = description
    .replace(/\b(no external research|without web research|no current facts needed|without online search)\b/gi, "")
    .replace(/bez (?:hledání|vyhledávání)[^.!?;]*/gi, "")
    .replace(/nepotřebuji[^.!?;]{0,100}(?:vyhledáv|hledat|web|externí zdroj)[^.!?;]*/gi, "");
  const highStakesFacts = /\b(medical|treatment|legal|tax|financial|investment|insurance)\b|léčb|lékař|právn|zákon|daň|pojištěn|invest|finanč/i.test(description);
  const currentFacts = /\b(current|latest|official|documentation|law|legal|tax|medical|health insurance|price|availability|regulation)\b|aktuáln|oficiáln|předpis|zákon|daň|pojištěn|cen[auyě]|dostupnost|lékař|léčb/i.test(requestedFacts);
  if (highStakesFacts) return true;
  if (noExternalFacts && !currentFacts) return false;
  const shoppingIntent = /\b(best|buy|choose|compare|recommend|shopping|purchase)\b|nejlepš|koup|vyber|vybrat|porovn|srovn|doporuč/i.test(description);
  return currentFacts || (intake.category === "product" && shoppingIntent) || ["travel", "relocation"].includes(intake.category);
}

export function ensureResearchQuestions(plan: AgentOutput<"planner">, intake: AgentOutput<"intake">, required: boolean, description = ""): AgentOutput<"planner"> {
  if (!required && declinesExternalResearch(description)) return { steps: plan.steps.map((step) => ({ ...step, researchQuestions: [] })) };
  if (!required || plan.steps.some((step) => step.researchQuestions.length > 0)) return plan;
  const goal = intake.goal.slice(0, 230);
  const title = intake.title.slice(0, 100);
  const fallback = [`${goal} official primary sources`, `${title} official requirements and limits`];
  return { steps: plan.steps.map((step, index) => index === 0 ? { ...step, researchQuestions: fallback } : step) };
}
