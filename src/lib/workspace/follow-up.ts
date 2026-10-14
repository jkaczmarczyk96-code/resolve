import { submissionSchema } from "./contracts";

export type PriorAnswer = { question: string; answer: string };

export function followUpDescription(originalRequest: string, unknown: string, priorAnswers: PriorAnswer[] = []) {
  const answeredContext = priorAnswers.slice(0, 8).map(({ question, answer }) =>
    `Question: ${question.trim().slice(0, 160)}\nUser's answer: ${answer.trim().slice(0, 500)}`,
  ).join("\n\n");
  return [
    "Create a focused follow-up analysis for one unresolved question from an existing Avenli problem.",
    `Original request: ${originalRequest.trim().slice(0, 4500)}`,
    `Question to resolve: ${unknown.trim().slice(0, 1000)}`,
    ...(answeredContext ? [`Context already provided by the user (unverified; do not ask for these details again):\n${answeredContext}`] : []),
    "Resolve this question with a practical answer. Use reliable external sources only when the answer depends on external facts; otherwise work from the user's details and state adjustable assumptions. Preserve unsupported details as unknowns, explain how the result affects the original request, and propose reviewable next steps. Do not contact anyone or perform an external action.",
  ].join("\n\n");
}

export function followUpSubmission(requestId: string, originalRequest: string, unknown: string, priorAnswers: PriorAnswer[] = []) {
  return submissionSchema.safeParse({ requestId, description: followUpDescription(originalRequest, unknown, priorAnswers) });
}
