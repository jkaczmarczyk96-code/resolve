import { submissionSchema } from "./contracts";

export function followUpDescription(goal: string, unknown: string) {
  return [
    "Create a focused follow-up analysis for one unresolved question from an existing Avenli problem.",
    `Original goal: ${goal.trim()}`,
    `Question to resolve: ${unknown.trim()}`,
    "Research this question using current reliable sources. Preserve unsupported details as unknowns, explain how the findings affect the original goal, and propose reviewable next steps. Do not contact anyone or perform an external action.",
  ].join("\n\n");
}

export function followUpSubmission(requestId: string, goal: string, unknown: string) {
  return submissionSchema.safeParse({ requestId, description: followUpDescription(goal, unknown) });
}
