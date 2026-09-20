import Link from "next/link";
import { cn } from "@/lib/utils";

export function AvenliMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 48 48" role="img" aria-label="Avenli" className={cn("size-10", className)}><path fill="#6039f5" d="M7.3 35.4 18.6 9.8a5.8 5.8 0 0 1 10.6.1l2.5 5.7-9.1 20.6a8.4 8.4 0 0 1-15.3-.8Z"/><path fill="#397bf6" d="M21.1 8.1a5.8 5.8 0 0 1 8.1 1.8l11.5 25.6a5.8 5.8 0 0 1-10.6 4.7L18.7 14.7a5.8 5.8 0 0 1 2.4-6.6Z"/><path fill="#8154f7" d="m13.5 21.4 9.8 5.9-4 9a8.4 8.4 0 0 1-12 3.7 5.8 5.8 0 0 1 0-4.6l6.2-14Z" opacity=".8"/></svg>;
}

export function AvenliBrand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" aria-label="Avenli home" className={cn("inline-flex items-center gap-2.5", className)}><AvenliMark className={compact ? "size-8" : "size-10"}/><span className={cn("font-semibold tracking-[-0.04em] text-[#10175c]", compact ? "text-xl" : "text-2xl")}>Avenli</span></Link>;
}
