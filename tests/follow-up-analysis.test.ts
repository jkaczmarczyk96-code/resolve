import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { followUpDescription, followUpSubmission } from "@/lib/workspace/follow-up";

it("builds a bounded focused problem without claiming an external action", () => {
  const goal = "Choose a safe route to the conference before noon.";
  const unknown = "Whether the morning train is running on the travel date.";
  const description = followUpDescription(goal, unknown);
  expect(description).toContain(`Original goal: ${goal}`);
  expect(description).toContain(`Question to resolve: ${unknown}`);
  expect(description).toContain("Do not contact anyone or perform an external action.");
  expect(followUpSubmission(randomUUID(), goal, unknown).success).toBe(true);
});

it("rejects an invalid request identifier before a paid follow-up starts", () => {
  expect(followUpSubmission("not-a-uuid", "A sufficiently detailed original goal", "A sufficiently detailed unresolved question").success).toBe(false);
});
