import type { Metadata } from "next";
import "./globals.css";
import { PublicChrome } from "@/components/public-chrome";

export const metadata: Metadata = {
  title: { default: "Avenli", template: "%s · Avenli" },
  description: "Give it a problem. Get it solved. A workspace for the outcomes that matter.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <PublicChrome />
        <main id="main-content" className="mx-auto max-w-[1440px]">{children}</main>
        <PublicChrome footer />
      </body>
    </html>
  );
}
