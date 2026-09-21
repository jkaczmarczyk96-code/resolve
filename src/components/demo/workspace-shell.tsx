"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, FlaskConical, Home, Layers, Plus, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { AvenliBrand } from "@/components/brand";
import { Onboarding } from "@/components/workspace/onboarding";
import { PageAnalytics } from "@/components/workspace/page-analytics";
import { cn } from "@/lib/utils";
import { useDemo } from "./demo-provider";

const navigation = [{ href: "/dashboard", label: "Home", icon: Home }, { href: "/problems", label: "Problems", icon: Layers }, { href: "/notifications", label: "Updates", icon: Bell }, { href: "/settings", label: "Settings", icon: Settings }];

export function WorkspaceShell({ children, onboardingComplete = true }: { children: React.ReactNode; onboardingComplete?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const isDemo = search.get("demo") === "1" || pathname.startsWith("/problems/demo-") || pathname.startsWith("/problems/draft-");
  const suffix = isDemo ? "?demo=1" : "";
  const { account, reset } = useDemo();
  const initial = (account.displayName || account.email || "A").trim().charAt(0).toUpperCase();
  return <div className="workspace-shell min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
    <PageAnalytics />{!isDemo && <Onboarding open={!onboardingComplete} />}
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e4e8f4] bg-white/90 px-4 py-6 backdrop-blur-xl lg:flex">
      <AvenliBrand compact className="mb-7 px-2" />
      <Button asChild size="lg" className="mb-6 w-full"><Link href={`/problems/new${suffix}`}><Plus aria-hidden="true" />New problem</Link></Button>
      <nav aria-label="Workspace" className="flex flex-col gap-1">{navigation.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-[linear-gradient(90deg,#edf0ff,#f3efff)] text-[#3c39dc] shadow-[inset_0_0_0_1px_rgba(89,72,236,.06)]" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</Link>;
      })}</nav>
      <div className="avenli-glow relative mt-auto overflow-hidden rounded-[1.25rem] p-4"><div className="absolute -bottom-12 -right-8 size-28 rounded-full bg-indigo-300/30 blur-2xl" aria-hidden="true"/><p className="relative text-[10px] font-semibold uppercase tracking-[.16em] text-[#5d5da5]">Your time matters</p><div className="relative mt-3 flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#151b62] text-sm font-semibold text-white">{initial}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#171a55]">{account.displayName || "Your account"}</p><p className="truncate text-[11px] text-muted-foreground">{account.email}</p></div></div><div className="relative mt-3"><LogoutButton /></div></div>
    </aside>
    <div className="min-w-0 px-4 pb-28 pt-4 sm:px-7 sm:pt-6 lg:px-9 lg:py-8 xl:px-12">
      <div className="mb-6 flex items-center justify-between lg:hidden"><AvenliBrand compact/><Link href={`/settings${suffix}`} aria-label="Account settings" className="flex size-10 items-center justify-center rounded-full bg-[#171b61] text-sm font-semibold text-white">{initial}</Link></div>
      {isDemo && <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-secondary/60 px-4 py-3"><div className="flex items-start gap-2.5"><FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong className="font-semibold">Interactive demo</strong><span className="text-muted-foreground"> · Sample data. Changes reset when you reload. No AI is running.</span></p></div><Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { reset(); router.push("/dashboard?demo=1"); }}><RotateCcw aria-hidden="true" />Reset demo</Button><Link className="text-sm text-primary underline" href="/dashboard">Your workspace</Link></div>}
      {children}
      <div className="mt-10 border-t pt-5 lg:hidden"><p className="mb-3 break-all text-sm text-muted-foreground">Account: {account.email}</p><LogoutButton /></div>
    </div>
    <nav aria-label="Workspace" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_12px_40px_rgba(23,20,82,.18)] backdrop-blur lg:hidden">{navigation.slice(0, 2).map(({ href, label, icon: Icon }) => { const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", active ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true"/>{label}</Link>; })}<Link href={`/problems/new${suffix}`} aria-label="New problem" className="mx-auto -mt-5 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3d54f3,#8137f2)] text-white shadow-lg shadow-violet-300"><Plus className="size-6" aria-hidden="true"/></Link>{navigation.slice(2).map(({ href, label, icon: Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", active ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Icon className="size-5" aria-hidden="true"/>{label}</Link>; })}</nav>
  </div>;
}
