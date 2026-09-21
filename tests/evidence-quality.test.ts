import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canonicalSource, evidenceQuality, publisherGroup } from "@/lib/ai/quality";
import { publicationDate } from "@/lib/ai/research";
import { groundVerification, validateOutput } from "@/lib/ai/integrity";
import { runFullWorkflow } from "@/lib/orchestration/full";
import { fullConfidence, parseFullSnapshot, type FullSnapshot } from "@/lib/orchestration/full-state";
import { MemoryFullStore, fullDependencies } from "./fixtures/full-workflow";
import { workflowRequest } from "./fixtures/workflow";
const at = "2026-09-11T12:00:00.000Z";
async function ideal(): Promise<FullSnapshot> {
  const s = await runFullWorkflow(workflowRequest(), new MemoryFullStore(), fullDependencies());
  const sources = ["https://docs.example.com/page", "https://public.example.org/page"].map((url, index) => ({ id: `source-${index + 1}`, url, title: "Fixture source", content: "The venue holds twenty participants.", retrievedAt: at, publishedAt: at }));
  return { ...s, intake: { ...s.intake!, unknowns: [], assumptions: [] },
    research: { ...s.research!, sources, output: { summary: "Fixture evidence", claims: [{ id: "claim-1", statement: "Capacity is twenty.", sourceIds: sources.map((source) => source.id) }], limitations: [] } },
    verification: { assessments: [{ claimId: "claim-1", status: "VERIFIED", sourceIds: sources.map((source) => source.id), supportingQuotes: sources.map((source) => ({ sourceId: source.id, quote: source.content })), sourceQuality: "Primary", freshness: "Recent", contradictions: [], summary: "Direct support" }], sourceProfiles: sources.map((source) => ({ sourceId: source.id, kind: "primary", reason: "Fixture first-party statement" })) },
    critique: { ...s.critique!, risks: [], evidenceWeaknesses: [], overlookedConstraints: [], unsupportedAssumptions: [] },
    options: { ...s.options!, limitations: [] }, decision: { ...s.decision!, confidence: "high", assumptions: [], unresolvedUnknowns: [], supportingEvidence: sources.map((source) => source.id) },
  };
}
it("groups publisher domains using public suffixes and removes tracking-only duplicate URLs", () => {
  expect(publisherGroup("https://docs.example.co.uk/a")).toBe("example.co.uk");
  expect(publisherGroup("https://news.example.co.uk/b")).toBe("example.co.uk");
  expect(publisherGroup("https://alice.github.io/a")).not.toBe(publisherGroup("https://bob.github.io/a"));
  expect(canonicalSource("https://example.com/page?utm_source=test&b=2&a=1#part")).toBe(canonicalSource("https://example.com/page?a=1&b=2"));
  expect(canonicalSource("https://example.com/page?next=/a/")).not.toBe(canonicalSource("https://example.com/page?next=/a"));
  expect(canonicalSource("https://example.com/page/")).not.toBe(canonicalSource("https://example.com/page"));
  expect(canonicalSource("https://example.com/page?id=1")).not.toBe(canonicalSource("https://example.com/page?id=2"));
});
it("caps even strong model-assessed evidence at medium and explains the independence limit", async () => {
  const result = evidenceQuality(await ideal(), undefined, at);
  expect(result.maxConfidence).toBe("medium"); expect(result.reasons).toEqual([]);
  expect(result.caveat).toContain("Different domains do not prove independent ownership");
});
it("downgrades conflicting claims, missing excerpts, duplicate publishers and unknown source authority", async () => {
  const s = await ideal();
  s.verification!.assessments[0].status = "CONFLICTING"; s.verification!.assessments[0].contradictions = ["Sources disagree on capacity."];
  expect(evidenceQuality(s, undefined, at).reasons).toContain("Evidence contains unresolved contradictions.");
  s.verification!.assessments[0].status = "VERIFIED"; s.verification!.assessments[0].contradictions = []; s.verification!.assessments[0].supportingQuotes = [];
  expect(evidenceQuality(s, undefined, at).reasons).toContain("Some claims lack a traceable supporting excerpt.");
  s.research!.sources[1].url = "https://blog.example.com/another-page";
  expect(evidenceQuality(s, undefined, at).supportingPublisherGroups).toBe(1);
  s.verification!.sourceProfiles = undefined;
  expect(evidenceQuality(s, undefined, at).sources.every((source) => source.kind === "unknown")).toBe(true);
  expect(evidenceQuality(s, undefined, at).maxConfidence).toBe("low");
});
it("distinguishes unknown publication, old publication, stale retrieval and invalid future metadata", async () => {
  const s = await ideal(); s.research!.sources[0].publishedAt = null;
  expect(evidenceQuality(s, undefined, at).sources[0].freshness).toBe("publication_unknown");
  s.research!.sources[0].publishedAt = "2020-01-01T00:00:00.000Z";
  expect(evidenceQuality(s, undefined, at).sources[0].freshness).toBe("review_due");
  s.research!.sources[0].publishedAt = at; s.research!.sources[0].retrievedAt = "2026-09-09T00:00:00.000Z"; s.intake!.category = "travel";
  expect(evidenceQuality(s, undefined, at).sources[0].freshness).toBe("review_due");
  s.research!.sources[0].retrievedAt = "2030-01-01T00:00:00.000Z";
  expect(evidenceQuality(s, undefined, at).sources[0].freshness).toBe("invalid_date");
  expect(publicationDate("2026-02-30")).toBeNull(); expect(publicationDate("yesterday")).toBeNull();
  expect(publicationDate("2026-09-11")).toBe("2026-09-11T00:00:00.000Z");
});
it("rejects fabricated supporting excerpts and preserves exact quoted support", async () => {
  const s = await ideal(); const context = { claims: s.research!.output.claims, sources: s.research!.sources };
  expect(() => validateOutput("verifier", context, s.verification, [])).not.toThrow();
  s.verification!.assessments[0].supportingQuotes![0].quote = "A fabricated statement absent from the source.";
  expect(() => validateOutput("verifier", context, s.verification, [])).toThrow("INVALID_OUTPUT");
  const grounded = groundVerification(s.verification!, context);
  expect(grounded.assessments[0]).toMatchObject({ status: "UNVERIFIED", unmatchedQuoteSourceIds: ["source-1"] });
  expect(grounded.assessments[0].supportingQuotes).toHaveLength(1);
  expect(() => validateOutput("verifier", context, grounded, [])).not.toThrow();
  grounded.assessments[0].supportingQuotes![0].sourceId = "foreign";
  expect(() => validateOutput("verifier", context, groundVerification(grounded, context), [])).toThrow("INVALID_OUTPUT");
});
it("preserves legacy snapshots and prevents raising a saved rating", async () => {
  const s = await runFullWorkflow(workflowRequest(), new MemoryFullStore(), fullDependencies());
  expect(s.qualityPolicy).toBe(2);
  expect(fullConfidence(s, s.decision!)).toBe("low");
  expect(() => parseFullSnapshot({ ...s, decision: { ...s.decision, confidence: "high" } })).toThrow("INVALID_CHECKPOINT");
  expect(parseFullSnapshot({ ...s, qualityPolicy: 1 }).qualityPolicy).toBe(1);
  const legacy = { ...s }; delete legacy.qualityPolicy;
  expect(parseFullSnapshot(legacy).decision?.confidence).toBe("low");
});
