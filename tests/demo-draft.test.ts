import { describe, expect, it } from "vitest";
import { createDemoDraft, draftInputSchema } from "@/lib/demo/draft";

describe("temporary demo drafts", () => {
  it("retains the description without inventing analysis or evidence", () => {
    const input = "I need to organize a community event with a limited budget.";
    const draft = createDemoDraft("draft-test", input);
    expect(draft.originalInput).toBe(input);
    expect(draft.status).toBe("Draft");
    expect(draft.recommendation).toBeNull();
    expect(draft.plan).toEqual([]);
    expect(draft.research).toEqual([]);
    expect(draft.constraints).toEqual([]);
  });
  it("rejects empty, insufficient and oversized descriptions", () => {
    for (const input of [" ", "Too short", "x".repeat(2001)]) expect(draftInputSchema.safeParse(input).success).toBe(false);
  });
});
