"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, FlaskConical, Home, Layers, Plus, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { AvenliBrand } from "@/components/brand";
import { BrandLandscape } from "@/components/brand-landscape";
import { Onboarding } from "@/components/workspace/onboarding";
import { PageAnalytics } from "@/components/workspace/page-analytics";
import { WorkspaceLanguageSwitch } from "@/components/workspace/workspace-language-switch";
import { cn } from "@/lib/utils";
import { useDemo } from "./demo-provider";

const navigation = [{ href: "/dashboard", label: "Home", icon: Home }, { href: "/problems", label: "Problems", icon: Layers }, { href: "/notifications", label: "Updates", icon: Bell }, { href: "/settings", label: "Settings", icon: Settings }];

export function WorkspaceShell({ children, onboardingComplete = true }: { children: React.ReactNode; onboardingComplete?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const isDemo = search.get("demo") === "1" || pathname.startsWith("/problems/demo-") || pathname.startsWith("/problems/draft-");
  const suffix = isDemo ? "?demo=1" : "";
  const { account, reset, preferences } = useDemo(); const cs = preferences.language === "cs";
  useEffect(() => { document.documentElement.lang = cs ? "cs" : "en"; }, [cs]);
  const navLabel = (label: string) => cs ? ({Home:"Domů",Problems:"Zadání",Updates:"Novinky",Settings:"Nastavení"} as Record<string,string>)[label] ?? label : label;
  const initial = (account.displayName || account.email || "A").trim().charAt(0).toUpperCase();
  return <div className="workspace-shell min-h-screen lg:grid lg:grid-cols-[208px_minmax(0,1fr)]">
    <PageAnalytics />{!isDemo && <Onboarding open={!onboardingComplete} />}
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e4e8f4] bg-white/90 px-3 py-5 backdrop-blur-xl lg:flex">
      <AvenliBrand compact className="mb-6 px-2" />
      <Button asChild className="mb-5 w-full"><Link href={`/problems/new${suffix}`}><Plus aria-hidden="true" />{cs ? "Nové zadání" : "New problem"}</Link></Button>
      <nav aria-label="Workspace" className="flex flex-col gap-1">{navigation.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-[linear-gradient(90deg,#edf0ff,#f3efff)] text-[#3c39dc] shadow-[inset_0_0_0_1px_rgba(89,72,236,.06)]" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{navLabel(label)}</Link>;
      })}</nav>
      <div className="relative mt-auto min-h-32 overflow-hidden rounded-2xl border border-[#d9def6] bg-[#ecf1ff] p-3.5"><BrandLandscape className="absolute inset-x-0 bottom-0 h-24 w-full opacity-85"/><p className="relative max-w-36 text-xs font-semibold leading-4 text-[#171a55]">{cs ? "Více možností. Klidnější rozhodování." : "Bigger possibilities. A calmer you."}</p></div>
      <div className="mt-3 rounded-xl border bg-white/75 p-2.5"><div className="flex items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#151b62] text-xs font-semibold text-white">{initial}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[#171a55]">{account.displayName || (cs ? "Váš účet" : "Your account")}</p><p className="truncate text-[10px] text-muted-foreground">{account.email}</p></div></div><div className="mt-2"><LogoutButton cs={cs} /></div></div>
    </aside>
    <div className="min-w-0 px-4 pb-28 pt-4 sm:px-6 sm:pt-5 lg:px-7 lg:py-6 xl:px-9"><div className="mx-auto w-full max-w-[1280px]">
      <div className="mb-6 flex items-center justify-between gap-2 lg:hidden"><AvenliBrand compact/><div className="flex items-center gap-2"><WorkspaceLanguageSwitch/><Link href={`/settings${suffix}`} aria-label={cs ? "Nastavení účtu" : "Account settings"} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#171b61] text-sm font-semibold text-white">{initial}</Link></div></div>
      <div className="mb-3 hidden justify-end lg:flex"><WorkspaceLanguageSwitch/></div>
      {isDemo && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-secondary/60 px-4 py-2.5"><div className="flex items-start gap-2.5"><FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong className="font-semibold">{cs ? "Ukázkový režim" : "Interactive demo"}</strong><span className="text-muted-foreground"> · {cs ? "Fiktivní data. Změny se při obnovení ztratí. AI zde neběží." : "Sample data. Changes reset when you reload. No AI is running."}</span></p></div><Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { reset(); router.push("/dashboard?demo=1"); }}><RotateCcw aria-hidden="true" />{cs ? "Obnovit ukázku" : "Reset demo"}</Button><Link className="text-sm text-primary underline" href="/dashboard">{cs ? "Můj prostor" : "Your workspace"}</Link></div>}
      {children}
    </div></div>
    <nav aria-label="Workspace" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_12px_40px_rgba(23,20,82,.18)] backdrop-blur lg:hidden">{navigation.slice(0, 2).map(({ href, label, icon: Icon }) => { const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", active ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true"/>{navLabel(label)}</Link>; })}<Link href={`/problems/new${suffix}`} aria-label={cs ? "Nové zadání" : "New problem"} className="mx-auto -mt-5 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3d54f3,#8137f2)] text-white shadow-lg shadow-violet-300"><Plus className="size-6" aria-hidden="true"/></Link>{navigation.slice(2).map(({ href, label, icon: Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", active ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true"/>{navLabel(label)}</Link>; })}</nav>
  </div>;
}
