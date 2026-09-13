import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Avenli", template: "%s · Avenli" },
  description: "Give it a problem. Get it solved. A workspace for the outcomes that matter.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card p-3 focus:not-sr-only">Skip to content</a>
        <header className="border-b bg-card">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-10">
            <Link href="/" aria-label="Avenli home" className="flex items-center gap-3 text-xl font-semibold tracking-tight">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white"><ArrowUpRight aria-hidden="true" className="size-6" /></span>
              avenli<span className="text-primary">.</span>
            </Link>
            <nav aria-label="Account" className="flex items-center gap-4 text-sm font-medium"><Link href="/dashboard" className="text-primary hover:underline">Open Avenli</Link><span className="hidden rounded-full border bg-muted px-3 py-1 text-muted-foreground sm:inline">Early access</span></nav>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1440px]">{children}</main>
        <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground"><span>Avenli · Give it a problem. Get it solved.</span><span className="mx-2">·</span><Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link><span className="mx-2">·</span><Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link></footer>
      </body>
    </html>
  );
}
