"use client";

import { AvenliMark } from "@/components/brand";
import { ui, useCzech } from "./ui-language";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`avenli-skeleton rounded-full ${className}`} aria-hidden="true" />;
}

export function LoadingSkeleton({ detail = false }: { detail?: boolean }) {
  const cs = useCzech();
  return <div role="status" aria-label={ui(cs, detail ? "Loading your problem" : "Loading your problems", detail ? "Načítání zadání" : "Načítání zadání")} className="space-y-4">
    <span className="sr-only">{ui(cs, "Loading saved information…", "Načítám uložené informace…")}</span>
    <div className="flex items-center gap-3"><span className="avenli-loading-mark flex size-10 items-center justify-center rounded-xl bg-[#eeeefe]"><AvenliMark className="size-7" /></span><div className="w-64 max-w-[70%] space-y-2"><Bar className="h-2 w-20"/><Bar className="h-5 w-full"/></div></div>
    {detail ? <><div className="avenli-panel flex gap-2 rounded-xl p-2"><Bar className="h-8 w-20"/><Bar className="h-8 w-20"/><Bar className="h-8 w-20"/></div><div className="grid gap-4 lg:grid-cols-[1.6fr_.7fr]"><div className="avenli-panel space-y-4 rounded-2xl p-5"><Bar className="h-3 w-20"/><Bar className="h-6 w-3/4"/><Bar className="h-3 w-full"/><Bar className="h-3 w-4/5"/><Bar className="h-9 w-32"/></div><div className="avenli-panel space-y-3 rounded-2xl p-5"><Bar className="h-3 w-28"/><Bar className="h-3 w-full"/><Bar className="h-3 w-3/4"/></div></div></> : <div className="avenli-panel overflow-hidden rounded-2xl"><div className="border-b p-4"><Bar className="h-3 w-32"/></div>{[0, 1, 2, 3].map((index) => <div key={index} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"><Bar className="size-9 shrink-0 rounded-xl"/><div className="min-w-0 flex-1 space-y-2"><Bar className={`h-3 ${index % 2 ? "w-2/5" : "w-3/5"}`}/><Bar className="h-2 w-4/5"/></div><Bar className="hidden h-5 w-20 sm:block"/></div>)}</div>}
  </div>;
}
