import { AuthSide } from "@/components/auth/auth-side";
import { BrandLandscape } from "@/components/brand-landscape";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-layout relative isolate mx-auto grid min-h-[calc(100vh-10rem)] max-w-6xl items-center gap-10 overflow-hidden px-5 py-12 lg:grid-cols-[.9fr_1.1fr]"><div className="absolute -left-40 top-20 -z-10 size-96 rounded-full bg-violet-200/45 blur-3xl"/><BrandLandscape className="absolute bottom-0 left-0 -z-10 hidden h-[20rem] w-[65%] opacity-50 lg:block"/><AuthSide/><div className="avenli-panel auth-card mx-auto w-full max-w-md rounded-[1.75rem] p-6 sm:p-9">{children}</div></div>;
}
