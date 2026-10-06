"use client";
import { evidenceQuality } from "@/lib/ai/quality";
import type { FullSnapshot } from "@/lib/orchestration/full-state";
import { Panel } from "@/components/demo/primitives";
import { ui, useCzech } from "./ui-language";

export function EvidenceQuality({ snapshot }: { snapshot: FullSnapshot }) {
  const cs = useCzech();
  const review = evidenceQuality(snapshot);
  const rating = snapshot.decision?.confidence === "low" ? "low" : review.maxConfidence;
  const confidence = (value: string) => ({ low: ui(cs,"low","nízká"), medium: ui(cs,"medium","střední"), high: ui(cs,"high","vysoká") } as Record<string,string>)[value] ?? value;
  return <Panel title={ui(cs,"Evidence quality","Kvalita podkladů")} description={ui(cs,"A rules-based review of the saved evidence. Refreshing this page does not fetch new sources.","Kontrola uložených podkladů podle pravidel. Obnovení stránky nehledá nové zdroje.")}>
    <p className="font-semibold">{ui(cs,"Current confidence ceiling","Nejvyšší možná míra jistoty")}: {confidence(review.maxConfidence)}</p>
    {snapshot.decision && <p className="mt-2 text-sm">{ui(cs,"Current recommendation confidence","Jistota aktuálního doporučení")}: {confidence(rating)} · {ui(cs,"Saved confidence","Uložená jistota")}: {confidence(snapshot.decision.confidence)}</p>}
    <p className="mt-3 text-sm text-muted-foreground">{review.distinctPages} {ui(cs,"distinct pages","různých stránek")} · {review.supportingPublisherGroups} {ui(cs,"supporting publisher domains","domén s podpůrnými podklady")} · {review.claims.filter((claim) => claim.grounded).length}/{review.claims.length} {ui(cs,"claims with supporting excerpts","tvrzení s podpůrnými úryvky")}</p>
    <ul className="mt-4 space-y-2 text-sm">{review.reasons.map((reason) => <li key={reason} className="break-words">• {reason}</li>)}</ul>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{review.caveat}</p>
    {!snapshot.qualityPolicy && <p className="mt-3 text-xs text-muted-foreground">{ui(cs,"This historical result used the earlier confidence policy. The current review does not rewrite its saved recommendation.","Tento starší výsledek použil předchozí pravidla jistoty. Nová kontrola uložené doporučení nepřepisuje.")}</p>}
    <div className="mt-5 space-y-3">{review.sources.map((source) => <div key={source.id} className="rounded-lg border p-3 text-sm"><p className="break-all font-medium">{source.id} · {source.group}</p><p className="mt-1">{source.kind} ({ui(cs,"model assessment","hodnocení modelem")}) · {source.freshness.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-muted-foreground">{source.reason}</p></div>)}</div>
    {review.claims.filter((claim) => claim.conflicting).map((claim) => <div key={claim.id} className="mt-4 rounded-lg border border-amber-400 p-4"><h3 className="font-semibold">{ui(cs,"Conflicting evidence","Rozporné podklady")}: {claim.id}</h3><ul className="mt-2 space-y-2 text-sm">{claim.contradictions.map((text, index) => <li key={index}>{text}</li>)}</ul><p className="mt-2 text-sm">{ui(cs,"Review this disagreement before relying on the claim.","Než se o tvrzení opřete, zkontrolujte tento rozpor.")}</p></div>)}
    {review.claims.some((claim) => claim.quotes.length) && <div className="mt-5 space-y-4"><h3 className="font-semibold">{ui(cs,"Supporting excerpts","Podpůrné úryvky")}</h3>{review.claims.flatMap((claim) => claim.quotes.map((quote, index) => <blockquote className="border-l-2 pl-4 text-sm" key={`${claim.id}-${index}`}><p className="whitespace-pre-wrap break-words">{quote.quote}</p><footer className="mt-2 text-xs text-muted-foreground">{claim.id} · {quote.sourceId} · {ui(cs,"Matched to the retrieved excerpt","Odpovídá nalezenému úryvku")}</footer></blockquote>))}</div>}
  </Panel>;
}
