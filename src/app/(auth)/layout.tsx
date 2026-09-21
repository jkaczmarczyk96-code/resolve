import { AvenliBrand } from "@/components/brand";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl items-center gap-10 overflow-hidden px-5 py-12 lg:grid-cols-[.9fr_1.1fr]"><div className="absolute -left-40 top-20 -z-10 size-96 rounded-full bg-violet-200/45 blur-3xl"/><div className="absolute -bottom-32 left-0 -z-10 h-72 w-[60%] -rotate-6 rounded-[50%] bg-[linear-gradient(120deg,rgba(102,73,245,.16),rgba(78,160,255,.13))] blur-2xl" aria-hidden="true"/><aside className="hidden lg:block"><AvenliBrand/><p className="mt-8 max-w-sm text-4xl font-semibold leading-tight tracking-[-.05em] text-[#111653]">Bigger possibilities.<br/>A calmer you.</p><p className="mt-5 max-w-sm leading-7 text-muted-foreground">Research, decisions, and next steps in one focused workspace.</p><div className="mt-10 flex max-w-sm items-center gap-3 rounded-2xl border border-white/80 bg-white/65 p-4 text-sm text-muted-foreground shadow-sm backdrop-blur"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary font-semibold text-primary">A</span><p>Curious. Helpful. Focused. On your side.</p></div></aside><div className="avenli-panel mx-auto w-full max-w-md rounded-[1.75rem] p-6 sm:p-9">{children}</div></div>;
}
