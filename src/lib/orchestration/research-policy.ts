import type { AgentOutput } from "@/lib/ai/schemas";

function declinesExternalResearch(description: string) {
  return /\b(no external research|without web research|no current facts needed|without online search|no need (?:for )?(?:web|external|online) research)\b|bez (?:hledání|vyhledávání)(?: (?:aktuálních|externích|na webu))?|bez externích zdrojů|nepotřebuji.{0,80}(?:vyhledáv|hledat|web|externí zdroj|dokumentac)|není třeba (?:web|internet|vyhledávání)/i.test(description);
}

/** Keep explicit requests for current facts on the evidence path, even if the planner omits queries. */
export function needsExternalEvidence(description: string, intake: AgentOutput<"intake">) {
  const noExternalFacts = declinesExternalResearch(description);
  const requestedFacts = description
    .replace(/\b(no external research|without web research|no current facts needed|without online search)\b/gi, "")
    .replace(/bez (?:hledání|vyhledávání)[^.!?;]*/gi, "")
    .replace(/nepotřebuji[^.!?;]{0,100}(?:vyhledáv|hledat|web|externí zdroj|dokumentac)[^.!?;]*/gi, "")
    .replace(/není třeba (?:web|internet|vyhledávání)[^.!?;]*/gi, "");
  const highStakesFacts = /\b(medical|treatment|legal|tax|financial|investment|insurance)\b|léčb|lékař|právn|zákon|daň|pojištěn|invest|finanč/i.test(description);
  const explicitCurrentFacts = /\b(current|latest|official|documentation|law|legal|tax|medical|health insurance|availability|regulation)\b|aktuáln|oficiáln|předpis|zákon|daň|pojištěn|dostupnost|lékař|léčb/i.test(requestedFacts);
  const asksForPrice = /(?:kolik|jak[aá]|zjist|ověř|najd|what|find|check).{0,100}(?:cen[auyě]|price|cost|stojí|vstupn)|(?:current|latest|aktuáln|official|oficiáln).{0,100}(?:cen[auyě]|price|cost|vstupn)/i.test(requestedFacts);
  const asksForListings = /\b(?:job openings|job listings|available jobs)\b|nabídky práce|pracovní inzerát|volná pracovní místa/i.test(requestedFacts);
  const currentFacts = explicitCurrentFacts || asksForPrice || asksForListings;
  if (highStakesFacts) return true;
  // A price *calculation* from values supplied by the user is not a request
  // for a live market price, even when the wording says "what is the price?".
  const selfContainedArithmetic = /\b(calculate|compute|discount|percent|percentage)\b|spočít|vypočít|sleva|procent/i.test(description)
    && /\d/.test(description) && !explicitCurrentFacts;
  if (selfContainedArithmetic) return false;
  if (noExternalFacts && !currentFacts) return false;
  const shoppingIntent = /\b(best|buy|choose|compare|recommend|shopping|purchase)\b|nejlepš|koup|vyber|vybrat|porovn|srovn|doporuč/i.test(description);
  return currentFacts || (intake.category === "product" && shoppingIntent) || ["travel", "relocation"].includes(intake.category);
}

export function ensureResearchQuestions(plan: AgentOutput<"planner">, intake: AgentOutput<"intake">, required: boolean, description = ""): AgentOutput<"planner"> {
  const personalCareerPlanning = /\b(?:career change|change jobs)\b|změnit práci|změna zaměstnání|před (?:podáním )?výpověd/i.test(description)
    && !/\b(?:research|browse|sources|job listings|job openings)\b|vyhledej|pracovní inzerát|nabídky práce|volná pracovní místa|zdroj[eů]/i.test(description);
  if (!required && (declinesExternalResearch(description) || personalCareerPlanning)) return { steps: plan.steps.map((step) => ({ ...step, researchQuestions: [] })) };
  if (!required || plan.steps.some((step) => step.researchQuestions.length > 0)) return plan;
  const goal = intake.goal.slice(0, 230);
  const title = intake.title.slice(0, 100);
  const fallback = [`${goal} official primary sources`, `${title} official requirements and limits`];
  return { steps: plan.steps.map((step, index) => index === 0 ? { ...step, researchQuestions: fallback } : step) };
}
