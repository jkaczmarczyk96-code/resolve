import { AvenliBrand } from "@/components/brand";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl items-center gap-10 overflow-hidden px-5 py-12 lg:grid-cols-[.9fr_1.1fr]"><div className="absolute -left-40 top-20 -z-10 size-96 rounded-full bg-violet-200/45 blur-3xl"/><aside className="hidden lg:block"><AvenliBrand/><p className="mt-8 max-w-sm text-4xl font-semibold leading-tight tracking-[-.04em] text-[#111653]">Bigger possibilities.<br/>A calmer you.</p><p className="mt-5 max-w-sm leading-7 text-muted-foreground">Research, decisions, and next steps in one focused workspace.</p></aside><div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_rgba(30,34,100,.14)] sm:p-9">{children}</div></div>;
}
