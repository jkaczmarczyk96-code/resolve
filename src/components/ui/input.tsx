import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn("flex h-11 w-full min-w-0 rounded-xl border bg-white/90 px-3.5 py-2 text-base shadow-[inset_0_1px_2px_rgba(24,31,82,.03)] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive", className)} {...props} />;
}
