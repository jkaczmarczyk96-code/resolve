import { getDomain } from "tldts";
import type { FullSnapshot } from "@/lib/orchestration/full-state";
import type { AgentOutput } from "./schemas";

export function publisherGroup(url: string) {
  const parsed = new URL(url);
  return getDomain(parsed.hostname, { allowPrivateDomains: true }) ?? parsed.hostname;
}
export function canonicalSource(url: string) {
  const parsed = new URL(url); parsed.hash = "";
  for (const name of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(name)) parsed.searchParams.delete(name);
  parsed.searchParams.sort();
  return parsed.toString();
}
const day = 86_400_000;
/** Version 1 review thresholds, not a claim that content expires at these ages. */
export function evidenceQuality(s: FullSnapshot, decision: AgentOutput<"decision"> | null = s.decision, at = new Date().toISOString()) {
  const now = Date.parse(at); const refreshDays = s.intake?.category === "travel" ? 1 : 30;
  const sources = (s.research?.sources ?? []).map((source) => {
    const retrieved = Date.parse(source.retrievedAt);
    const publication = source.publishedAt ? Date.parse(source.publishedAt) : null;
    const profile = s.verification?.sourceProfiles?.find((item) => item.sourceId === source.id);
    const future = retrieved > now + 300_000 || (publication !== null && publication > now + 300_000);
    const stale = now - retrieved > refreshDays * day || (publication !== null && now - publication > 365 * day);
    return { id: source.id, group: publisherGroup(source.url), canonical: canonicalSource(source.url), kind: profile?.kind ?? "unknown", reason: profile?.reason ?? "No structured source assessment is available.", freshness: future ? "invalid_date" : stale ? "review_due" : publication === null ? "publication_unknown" : "recent", retrievedAt: source.retrievedAt, publishedAt: source.publishedAt ?? null };
  });
  const claims = (s.research?.output.claims ?? []).map((claim) => {
    const assessment = s.verification?.assessments.find((item) => item.claimId === claim.id);
    const quotes = assessment?.supportingQuotes ?? [];
    const conflicting = assessment?.status === "CONFLICTING" || Boolean(assessment?.contradictions.length);
    return { id: claim.id, status: assessment?.status ?? "UNVERIFIED", grounded: quotes.length > 0, conflicting, quotes, contradictions: assessment?.contradictions ?? [] };
  });
  const supporting = sources.filter((source) => decision?.supportingEvidence.includes(source.id));
  const groups = new Set(supporting.map((source) => source.group));
  const unique = new Set(sources.map((source) => source.canonical));
  const reasons: string[] = [];
  if (!sources.length) reasons.push("No sources were retrieved.");
  if (!claims.length) reasons.push("No evidence-backed claims were recorded.");
  if (s.verification?.assessments.some((claim) => claim.unmatchedQuoteSourceIds?.length)) reasons.push("Unmatched model quotations were discarded and their claims require review.");
  if (claims.some((claim) => claim.conflicting)) reasons.push("Evidence contains unresolved contradictions.");
  if (claims.some((claim) => claim.status !== "VERIFIED")) reasons.push("Not every claim is assessed as verified.");
  if (claims.some((claim) => !claim.grounded)) reasons.push("Some claims lack a traceable supporting excerpt.");
  if (sources.some((source) => source.freshness === "review_due")) reasons.push(`Evidence needs a freshness review (${refreshDays}-day retrieval / 365-day publication threshold).`);
  if (sources.some((source) => source.freshness === "invalid_date")) reasons.push("A source contains a future timestamp; its freshness cannot be established.");
  if (supporting.some((source) => source.freshness === "publication_unknown")) reasons.push("The publication date of supporting evidence is unknown.");
  if (supporting.some((source) => !["primary", "secondary"].includes(source.kind))) reasons.push("Supporting source authority is unknown or community-assessed.");
  if (groups.size < 2) reasons.push("Fewer than two publisher domains support the recommendation.");
  if (unique.size < sources.length) reasons.push("Some retrieved links are duplicate versions of the same page.");
  if (!decision?.selectedOptionId) reasons.push("No option has been selected.");
  if ((decision?.unresolvedUnknowns.length ?? 0) || (!s.human?.responses && s.intake?.unknowns.length)) reasons.push("User or decision unknowns remain unresolved.");
  if ((decision?.assumptions.length ?? 0) || s.intake?.assumptions.length) reasons.push("The recommendation depends on assumptions.");
  if (!s.critique || s.critique.risks.length || s.critique.evidenceWeaknesses.length || s.critique.overlookedConstraints.length || s.critique.unsupportedAssumptions.length) reasons.push("Critic concerns remain open or have not been assessed.");
  if ((s.plan?.steps.flatMap((step) => step.researchQuestions).length ?? 0) > 1 || s.research?.output.limitations.length || s.options?.limitations.length) reasons.push("Research coverage or candidate options have stated limitations.");
  if (decision?.supportingEvidence.some((id) => !s.verification?.assessments.some((claim) => claim.status === "VERIFIED" && claim.sourceIds.includes(id) && claim.supportingQuotes?.some((quote) => quote.sourceId === id)))) reasons.push("A recommendation citation lacks a verified supporting excerpt.");
  return { assessedAt: at, refreshDays, sources, claims, distinctPages: unique.size, supportingPublisherGroups: groups.size, maxConfidence: reasons.length ? "low" as const : "medium" as const, reasons, caveat: "Source kinds and verification are model assessments. Different domains do not prove independent ownership. High confidence is withheld until independence and completeness are established." };
}
