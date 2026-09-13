"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, FlaskConical, LayoutGrid, Layers, Plus, RotateCcw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import { useDemo } from "./demo-provider";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const isDemo = search.get("demo") === "1" || pathname.startsWith("/problems/demo-") || pathname.startsWith("/problems/draft-");
  const suffix = isDemo ? "?demo=1" : "";
  const { account, reset } = useDemo();
  return <div className="min-h-[calc(100vh-5rem)] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
    <aside className="flex flex-col gap-5 border-b bg-card p-4 lg:border-r lg:border-b-0 lg:p-5">
      <Button asChild className="hidden lg:inline-flex"><Link href={`/problems/new${suffix}`}><Plus aria-hidden="true" />New problem</Link></Button>
      <nav aria-label="Workspace" className="flex flex-wrap gap-2 lg:flex-col">{[{ href: "/dashboard", label: "Overview", icon: LayoutGrid }, { href: "/problems", label: "Problems", icon: Layers }, { href: "/notifications", label: "Notifications", icon: Bell }, { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={`${href}${suffix}`} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted")}><Icon className="size-4" aria-hidden="true" />{label}</Link>;
      })}</nav>
      <div className="hidden space-y-4 border-t pt-5 lg:mt-auto lg:block"><p className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</p><p className="break-all text-sm font-medium">{account.email}</p><LogoutButton /></div>
    </aside>
    <div className="min-w-0 p-5 sm:p-8 xl:p-10">
      {isDemo && <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-secondary/60 px-4 py-3"><div className="flex items-start gap-2.5"><FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong className="font-semibold">Interactive demo</strong><span className="text-muted-foreground"> · Sample data. Changes reset when you reload. No AI is running.</span></p></div><Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { reset(); router.push("/dashboard?demo=1"); }}><RotateCcw aria-hidden="true" />Reset demo</Button><Link className="text-sm text-primary underline" href="/dashboard">Your workspace</Link></div>}
      {children}
      <div className="mt-10 border-t pt-5 lg:hidden"><p className="mb-3 break-all text-sm text-muted-foreground">Account: {account.email}</p><LogoutButton /></div>
    </div>
  </div>;
}
