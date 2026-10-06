"use client";
import { AvenliBrand } from "@/components/brand";
import { usePublicCzech } from "@/components/public-language";

export function AuthSide() {
  const cs = usePublicCzech();
  return <aside className="hidden lg:block"><AvenliBrand/><p className="mt-8 max-w-sm text-4xl font-semibold leading-tight tracking-[-.05em] text-[#111653]">{cs ? <>Více možností.<br/>Klidnější rozhodování.</> : <>Bigger possibilities.<br/>A calmer you.</>}</p><p className="mt-5 max-w-sm leading-7 text-muted-foreground">{cs ? "Výzkum, rozhodnutí a další kroky v jednom přehledném prostoru." : "Research, decisions, and next steps in one focused workspace."}</p><div className="mt-10 flex max-w-sm items-center gap-3 rounded-2xl border border-white/80 bg-white/65 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary font-semibold text-primary">A</span><p>{cs ? "Zvídavá. Užitečná. Soustředěná. Na vaší straně." : "Curious. Helpful. Focused. On your side."}</p></div></aside>;
}
