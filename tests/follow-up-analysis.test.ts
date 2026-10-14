import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { followUpDescription, followUpSubmission } from "@/lib/workspace/follow-up";

it("builds a bounded focused problem without claiming an external action", () => {
  const goal = "Choose a safe route to the conference before noon.";
  const unknown = "Whether the morning train is running on the travel date.";
  const description = followUpDescription(goal, unknown);
  expect(description).toContain(`Original request: ${goal}`);
  expect(description).toContain(`Question to resolve: ${unknown}`);
  expect(description).toContain("Do not contact anyone or perform an external action.");
  expect(followUpSubmission(randomUUID(), goal, unknown).success).toBe(true);
});

it("rejects an invalid request identifier before a paid follow-up starts", () => {
  expect(followUpSubmission("not-a-uuid", "A sufficiently detailed original goal", "A sufficiently detailed unresolved question").success).toBe(false);
});

it("carries previous user answers into a follow-up without treating them as verified facts", () => {
  const answers = [{ question: "What field are your final exams in?", answer: "History" }];
  const description = followUpDescription("Prepare a study schedule", "Find official exam requirements", answers);
  expect(description).toContain("User's answer: History");
  expect(description).toContain("unverified; do not ask for these details again");
  expect(followUpSubmission(randomUUID(), "Prepare a study schedule", "Find official exam requirements", answers).success).toBe(true);
  expect(followUpSubmission(randomUUID(), "x".repeat(12000), "y".repeat(2000), Array.from({ length: 8 }, () => ({ question: "q".repeat(2000), answer: "a".repeat(1200) }))).success).toBe(true);
});
