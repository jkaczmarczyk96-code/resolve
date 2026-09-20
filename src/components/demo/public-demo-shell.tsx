"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FlaskConical, Home, Layers, LogIn, Plus, RotateCcw } from "lucide-react";
import { AvenliBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDemo } from "./demo-provider";

const navigation = [
  { href: "/demo", label: "Home", icon: Home },
  { href: "/demo/problems", label: "Problems", icon: Layers },
];

export function PublicDemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { reset } = useDemo();
  const active = (href: string) => href === "/demo" ? pathname === href : pathname.startsWith(href);
  const resetDemo = () => { reset(); router.push("/demo"); };

  return <div className="workspace-shell min-h-screen bg-[radial-gradient(circle_at_90%_10%,rgba(112,91,255,.08),transparent_28%)] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <aside className="hidden flex-col border-r bg-white/80 px-5 py-7 backdrop-blur lg:flex">
      <AvenliBrand compact className="mb-8 px-2" />
      <Button asChild size="lg" className="mb-6 rounded-xl bg-[linear-gradient(135deg,#384ff2,#7b36f4)] shadow-lg shadow-violet-200"><Link href="/demo/problems/new"><Plus aria-hidden="true" />New problem</Link></Button>
      <nav aria-label="Demo workspace" className="flex flex-col gap-1">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition", active(href) ? "bg-[#eef0ff] text-[#3c39dc] shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-4" aria-hidden="true" />{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl bg-[linear-gradient(160deg,#f3f0ff,#edf6ff)] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#5d5da5]">Public demo</p><p className="mt-2 text-sm text-muted-foreground">Fictional data. Nothing is saved and no AI or external service is called.</p><Button asChild variant="outline" size="sm" className="mt-4 w-full"><Link href="/login?next=%2Fdashboard"><LogIn aria-hidden="true" />Sign in</Link></Button></div>
    </aside>
    <div className="min-w-0 px-4 pb-28 pt-6 sm:px-7 sm:pt-8 lg:p-10 xl:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-secondary/60 px-4 py-3"><div className="flex items-start gap-2.5"><FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong className="font-semibold">Interactive public demo</strong><span className="text-muted-foreground"> · Fictional data. Changes reset when you reload. No AI is running.</span></p></div><div className="flex items-center gap-3"><Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetDemo}><RotateCcw aria-hidden="true" />Reset demo</Button><Link className="text-sm text-primary underline" href="/login?next=%2Fdashboard">Sign in</Link></div></div>
      {children}
    </div>
    <nav aria-label="Demo workspace" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-[0_12px_40px_rgba(23,20,82,.18)] backdrop-blur lg:hidden"><Link href="/demo" aria-current={pathname === "/demo" ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", pathname === "/demo" ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Home className="size-5" aria-hidden="true"/>Home</Link><Link href="/demo/problems/new" aria-label="New problem" className="mx-auto -mt-5 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3d54f3,#8137f2)] text-white shadow-lg shadow-violet-300"><Plus className="size-6" aria-hidden="true"/></Link><Link href="/demo/problems" aria-current={pathname.startsWith("/demo/problems") ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium", pathname.startsWith("/demo/problems") ? "bg-[#eef0ff] text-[#4436e8]" : "text-muted-foreground")}><Layers className="size-5" aria-hidden="true"/>Problems</Link></nav>
  </div>;
}
