"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AvenliBrand } from "@/components/brand";
import { usePublicCzech } from "@/components/public-language";

export function PublicChrome({ footer = false }: { footer?: boolean }) {
  const cs = usePublicCzech();
  const pathname = usePathname();
  useEffect(() => { if (!document.querySelector(".workspace-shell")) document.documentElement.lang = cs ? "cs" : "en"; }, [cs, pathname]);
  if (footer) return <footer className="border-t border-[#e7e9f4] bg-white/70 px-6 py-7 text-center text-xs text-muted-foreground"><span>Avenli · {cs ? "Svěřte nám problém. Získejte jasný postup." : "Give it a problem. Get it solved."}</span><span className="mx-2">·</span><Link href="/privacy" className="hover:text-foreground hover:underline">{cs ? "Soukromí" : "Privacy"}</Link><span className="mx-2">·</span><Link href="/terms" className="hover:text-foreground hover:underline">{cs ? "Podmínky" : "Terms"}</Link></footer>;
  return <><a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card p-3 focus:not-sr-only">{cs ? "Přejít na obsah" : "Skip to content"}</a><header className="border-b border-white/70 bg-white/85 backdrop-blur-xl"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><AvenliBrand compact/><nav aria-label={cs ? "Účet" : "Account"} className="flex items-center gap-3 text-sm font-medium"><Link href="/dashboard" className="rounded-full px-4 py-2 text-[#3430d7] hover:bg-[#f0f0ff]">{cs ? "Otevřít Avenli" : "Open Avenli"}</Link><span className="hidden rounded-full border border-[#e1e2fb] bg-[#f7f7ff] px-3 py-1 text-[#5b5d91] sm:inline">{cs ? "Předběžný přístup" : "Early access"}</span></nav></div></header></>;
}
