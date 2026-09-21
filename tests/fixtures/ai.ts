import type { AgentInput, AgentName, AgentOutput, Source } from "@/lib/ai/schemas";

export const sources: Source[] = [{ id: "source-1", url: "https://example.org/community-room", title: "Fixture: community room", content: "Fictional test evidence: the room seats 20 people. The hire cost is not stated.", retrievedAt: "2026-09-09T12:00:00.000Z" }];
export const problem: AgentOutput<"intake"> = { title: "Plan a community event", goal: "Host a community event for 20 people", constraints: ["Budget is EUR 500"], knownFacts: ["Expected attendance is 20"], assumptions: [], unknowns: ["Venue cost"], category: "other", initialAssessment: "Confirm a suitable venue and cost before committing." };
export const plan: AgentOutput<"planner"> = { steps: [{ id: "step-1", title: "Check venue", description: "Confirm capacity and price.", priority: "high", dependencies: [], researchQuestions: ["What is the venue capacity?"], userQuestions: ["What date should the event take place?"] }] };
export const research: AgentOutput<"researcher"> = { summary: "The supplied fixture describes the capacity.", claims: [{ id: "claim-1", statement: "The room seats 20 people.", sourceIds: ["source-1"] }], limitations: ["Fictional evidence; hire cost is unknown."] };
export const verification: AgentOutput<"verifier"> = { assessments: [{ claimId: "claim-1", status: "PARTIALLY_VERIFIED", sourceIds: ["source-1"], supportingQuotes: [{ sourceId: "source-1", quote: "the room seats 20 people" }], sourceQuality: "Fictional test fixture", freshness: "Publication time unknown", contradictions: [], summary: "Text supports capacity, but this is not real-world verification." }] };
export const critique: AgentOutput<"critic"> = { overlookedConstraints: [], unsupportedAssumptions: ["The venue may be unavailable."], evidenceWeaknesses: ["Only a fictional excerpt is supplied."], risks: ["The cost could exceed the budget."], alternativeSuggestions: ["Ask about a free venue."], failureScenarios: ["No venue on the chosen date."], summary: "The plan needs price and date confirmation." };
const options = [{ id: "option-1", title: "Investigate community room", description: "Ask for a quote; do not book.", risks: ["Unknown price"] }];
export const inputs = {
  intake: { description: "Help me plan a community event for 20 people with a budget of EUR 500." },
  planner: { problem }, researcher: { question: "What is the room capacity according to the supplied test fixture?" },
  verifier: { claims: research.claims, sources },
  critic: { problem, plan, options, sources, verification, claims: research.claims },
  decision: { goal: problem.goal, constraints: problem.constraints, options, sources, claims: research.claims, verification, critique, risks: critique.risks },
  options: { problem, plan, sources, claims: research.claims, verification },
  tasks: { problem, plan, options, decision: { recommendation: "Investigate the room", selectedOptionId: "option-1", confidence: "low", reasoningSummary: "Confirm price first", supportingEvidence: [], assumptions: [], unresolvedUnknowns: ["Cost"], rejectedAlternatives: [] } },
} satisfies { [N in AgentName]: AgentInput<N> };
export const outputs = {
  intake: problem, planner: plan, researcher: research, verifier: verification, critic: critique,
  options: { options, limitations: ["Price not checked"] },
  tasks: { tasks: [{ id: "task-1", title: "Request a quote", description: "Ask the venue about the cost before booking.", priority: "high", dependencies: [], planStepId: "step-1", optionId: "option-1", status: "proposed" }] },
  decision: { recommendation: "Request a quote before deciding.", selectedOptionId: "option-1", confidence: "low", reasoningSummary: "Capacity is plausible but cost and date are unknown.", supportingEvidence: ["source-1"], assumptions: [], unresolvedUnknowns: ["Hire cost", "Date"], rejectedAlternatives: [] },
} satisfies { [N in AgentName]: AgentOutput<N> };
