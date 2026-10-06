"use client";

import { ui, useCzech } from "./ui-language";

export function LoadingSkeleton({ detail = false }: { detail?: boolean }) {
  const cs = useCzech();
  return <div role="status" aria-label={ui(cs, detail ? "Loading your problem" : "Loading your problems", detail ? "Načítání zadání" : "Načítání zadání")} className="space-y-5">
    <span className="sr-only">{ui(cs, "Loading saved information…", "Načítám uložené informace…")}</span>
    <div className="avenli-panel rounded-[1.25rem] p-6"><div className="avenli-skeleton h-3 w-24 rounded-full"/><div className="avenli-skeleton mt-5 h-8 max-w-sm rounded-lg"/><div className="avenli-skeleton mt-4 h-3 max-w-lg rounded-full"/></div>
    <div className={`grid gap-4 ${detail ? "lg:grid-cols-[1.4fr_.8fr]" : "md:grid-cols-2 xl:grid-cols-3"}`}>{Array.from({ length: detail ? 2 : 3 }, (_, index) => <div key={index} className="avenli-panel rounded-[1.25rem] p-6"><div className="avenli-skeleton h-4 w-24 rounded-full"/><div className="avenli-skeleton mt-6 h-5 w-3/4 rounded-md"/><div className="avenli-skeleton mt-4 h-3 w-full rounded-full"/><div className="avenli-skeleton mt-2 h-3 w-2/3 rounded-full"/></div>)}</div>
  </div>;
}
