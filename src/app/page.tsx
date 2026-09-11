import { Compass, ListChecks, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-14 sm:px-10 sm:py-20">
      <section className="max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">A place to move forward</p>
        <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-6xl">Give it a problem.<br /><span className="text-primary">Get it solved.</span></h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">A workspace for your goal, the evidence behind your decisions, and what needs to happen next.</p>
        <div className="flex flex-wrap gap-3"><Button asChild><Link href="/register">Create account</Link></Button><Button asChild variant="outline"><Link href="/login">Sign in</Link></Button></div>
      </section>
      <section aria-labelledby="preview-title" className="rounded-xl border border-primary/20 bg-secondary p-6">
        <h2 id="preview-title" className="font-semibold">From a problem to a plan you can review</h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">Describe a problem, follow the analysis, and review its research, recommendation, risks and proposed tasks. Your progress is saved in your account.</p>
      </section>
      <section aria-label="The Resolve approach" className="grid gap-5 md:grid-cols-3">
        {[
          { icon: Compass, title: "Start with the outcome", description: "Keep the goal and the constraints that matter in one place." },
          { icon: ShieldCheck, title: "Know what supports it", description: "Bring evidence, open questions, and risks into the decision." },
          { icon: ListChecks, title: "Make the next step clear", description: "Turn a decision into a plan you can follow." },
        ].map(({ icon: Icon, title, description }) => (
          <Card key={title} className="shadow-none">
            <CardHeader><Icon aria-hidden="true" className="mb-4 size-6 text-primary" /><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
            <CardContent><p className="leading-relaxed text-muted-foreground">{description}</p></CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
