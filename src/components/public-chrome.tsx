"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe2 } from "lucide-react";
import { AvenliBrand } from "@/components/brand";
import { setPublicLanguage, usePublicCzech } from "@/components/public-language";

export function PublicChrome({ footer = false }: { footer?: boolean }) {
  const cs = usePublicCzech();
  const pathname = usePathname();
  useEffect(() => { if (!document.querySelector(".workspace-shell")) document.documentElement.lang = cs ? "cs" : "en"; }, [cs, pathname]);
  if (footer) return <footer className="border-t border-[#e7e9f4] bg-white/70 px-6 py-7 text-center text-xs text-muted-foreground"><span>Avenli · {cs ? "Svěřte nám problém. Získejte jasný postup." : "Give it a problem. Get it solved."}</span><span className="mx-2">·</span><Link href="/privacy" className="hover:text-foreground hover:underline">{cs ? "Soukromí" : "Privacy"}</Link><span className="mx-2">·</span><Link href="/terms" className="hover:text-foreground hover:underline">{cs ? "Podmínky" : "Terms"}</Link></footer>;
  return <><a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card p-3 focus:not-sr-only">{cs ? "Přejít na obsah" : "Skip to content"}</a><header className="border-b border-white/70 bg-white/85 backdrop-blur-xl"><div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8"><AvenliBrand compact/><div className="flex items-center gap-2 sm:gap-4"><div role="group" aria-label={cs ? "Jazyk stránky" : "Page language"} className="flex items-center gap-1 rounded-full border border-[#d9dcf7] bg-[#f3f3ff] p-1 shadow-sm"><Globe2 className="ml-2 hidden size-4 text-[#4442b8] sm:block" aria-hidden="true"/><button type="button" onClick={() => setPublicLanguage("en")} aria-pressed={!cs} className={`min-w-10 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b45e9] ${!cs ? "bg-[#443de0] text-white shadow-sm" : "text-[#4c5185] hover:bg-white"}`}>EN</button><button type="button" onClick={() => setPublicLanguage("cs")} aria-pressed={cs} className={`min-w-10 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b45e9] ${cs ? "bg-[#443de0] text-white shadow-sm" : "text-[#4c5185] hover:bg-white"}`}>CZ</button></div><nav aria-label={cs ? "Účet" : "Account"} className="text-sm font-medium"><Link href="/dashboard" className="rounded-full px-2 py-2 text-[#3430d7] hover:bg-[#f0f0ff] sm:px-4"><span className="sm:hidden">{cs ? "Otevřít" : "Open"}</span><span className="hidden sm:inline">{cs ? "Otevřít Avenli" : "Open Avenli"}</span></Link></nav></div></div></header></>;
}
