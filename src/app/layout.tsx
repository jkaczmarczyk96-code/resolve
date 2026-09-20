import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AvenliBrand } from "@/components/brand";

export const metadata: Metadata = {
  title: { default: "Avenli", template: "%s · Avenli" },
  description: "Give it a problem. Get it solved. A workspace for the outcomes that matter.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-card p-3 focus:not-sr-only">Skip to content</a>
        <header className="border-b border-white/70 bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
            <AvenliBrand compact />
            <nav aria-label="Account" className="flex items-center gap-3 text-sm font-medium"><Link href="/dashboard" className="rounded-full px-4 py-2 text-[#3430d7] hover:bg-[#f0f0ff]">Open Avenli</Link><span className="hidden rounded-full border border-[#e1e2fb] bg-[#f7f7ff] px-3 py-1 text-[#5b5d91] sm:inline">Early access</span></nav>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1440px]">{children}</main>
        <footer className="border-t border-[#e7e9f4] bg-white/70 px-6 py-7 text-center text-xs text-muted-foreground"><span>Avenli · Give it a problem. Get it solved.</span><span className="mx-2">·</span><Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link><span className="mx-2">·</span><Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link></footer>
      </body>
    </html>
  );
}
