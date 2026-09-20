import Link from "next/link";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-14 sm:px-10 sm:py-20">
      <Link href="/" className="text-sm font-medium text-primary hover:underline">← Back to Avenli</Link>
      <header className="mt-8 border-b pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Avenli</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <p className="mt-4 text-sm text-muted-foreground">Effective September 14, 2026</p>
      </header>
      <div className="space-y-8 py-8 leading-relaxed [&_a]:text-primary [&_a]:underline [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2">{children}</div>
    </article>
  );
}
