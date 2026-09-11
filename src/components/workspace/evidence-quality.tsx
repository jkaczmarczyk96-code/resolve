"use client";
import { evidenceQuality } from "@/lib/ai/quality";
import type { FullSnapshot } from "@/lib/orchestration/full-state";
import { Panel } from "@/components/demo/primitives";

export function EvidenceQuality({ snapshot }: { snapshot: FullSnapshot }) {
  const review = evidenceQuality(snapshot);
  const rating = snapshot.decision?.confidence === "low" ? "low" : review.maxConfidence;
  return <Panel title="Evidence quality" description="A rules-based review of the saved evidence. Refreshing this page does not fetch new sources.">
    <p className="font-semibold">Current confidence ceiling: {review.maxConfidence}</p>
    {snapshot.decision && <p className="mt-2 text-sm">Current recommendation confidence: {rating} · Saved confidence: {snapshot.decision.confidence}</p>}
    <p className="mt-3 text-sm text-muted-foreground">{review.distinctPages} distinct pages · {review.supportingPublisherGroups} supporting publisher domains · {review.claims.filter((claim) => claim.grounded).length}/{review.claims.length} claims with supporting excerpts</p>
    <ul className="mt-4 space-y-2 text-sm">{review.reasons.map((reason) => <li key={reason} className="break-words">• {reason}</li>)}</ul>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{review.caveat}</p>
    {!snapshot.qualityPolicy && <p className="mt-3 text-xs text-muted-foreground">This historical result used the earlier confidence policy. The current review does not rewrite its saved recommendation.</p>}
    <div className="mt-5 space-y-3">{review.sources.map((source) => <div key={source.id} className="rounded-lg border p-3 text-sm"><p className="break-all font-medium">{source.id} · {source.group}</p><p className="mt-1">{source.kind} (model assessment) · {source.freshness.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-muted-foreground">{source.reason}</p></div>)}</div>
    {review.claims.filter((claim) => claim.conflicting).map((claim) => <div key={claim.id} className="mt-4 rounded-lg border border-amber-400 p-4"><h3 className="font-semibold">Conflicting evidence: {claim.id}</h3><ul className="mt-2 space-y-2 text-sm">{claim.contradictions.map((text, index) => <li key={index}>{text}</li>)}</ul><p className="mt-2 text-sm">Resolve this disagreement before relying on the claim.</p></div>)}
    {review.claims.some((claim) => claim.quotes.length) && <div className="mt-5 space-y-4"><h3 className="font-semibold">Supporting excerpts</h3>{review.claims.flatMap((claim) => claim.quotes.map((quote, index) => <blockquote className="border-l-2 pl-4 text-sm" key={`${claim.id}-${index}`}><p className="whitespace-pre-wrap break-words">{quote.quote}</p><footer className="mt-2 text-xs text-muted-foreground">{claim.id} · {quote.sourceId} · Matched to the retrieved excerpt</footer></blockquote>))}</div>}
  </Panel>;
}
