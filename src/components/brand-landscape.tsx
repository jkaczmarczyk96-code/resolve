import { cn } from "@/lib/utils";

/** Decorative, resolution-independent artwork shared by the public and workspace surfaces. */
export function BrandLandscape({ className }: { className?: string }) {
  return <svg viewBox="0 0 960 390" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" className={cn("pointer-events-none", className)}>
    <defs>
      <linearGradient id="avenli-sky" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f8f9ff"/><stop offset=".55" stopColor="#dce8ff"/><stop offset="1" stopColor="#c7c9ff"/></linearGradient>
      <linearGradient id="avenli-far" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#c5d7ff"/><stop offset="1" stopColor="#949fea"/></linearGradient>
      <linearGradient id="avenli-near" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#6a77d8"/><stop offset=".58" stopColor="#5553c6"/><stop offset="1" stopColor="#2f317f"/></linearGradient>
      <linearGradient id="avenli-wave" x1="0" x2="1" y1="0" y2="0"><stop stopColor="#6952ee" stopOpacity=".72"/><stop offset=".55" stopColor="#9a8cff" stopOpacity=".35"/><stop offset="1" stopColor="#5e9bff" stopOpacity=".45"/></linearGradient>
      <radialGradient id="avenli-halo"><stop stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></radialGradient>
    </defs>
    <path fill="url(#avenli-sky)" d="M0 0h960v390H0z"/>
    <ellipse cx="716" cy="144" rx="205" ry="115" fill="url(#avenli-halo)"/>
    <path d="M0 277 104 219l75 37 137-115 99 89 113-105 81 83 118-96 97 99 136-71v250H0Z" fill="url(#avenli-far)" opacity=".7"/>
    <path d="m0 327 129-89 61 39 123-99 86 98 137-130 104 111 128-95 192 144v84H0Z" fill="url(#avenli-near)"/>
    <path d="m279 212 34-34 27 30-24-9-13 14-13-7Zm225-34 32-32 29 32-25-10-12 12-12-7Zm235 10 29-26 26 27-20-9-11 10-10-5Z" fill="#f3f5ff" opacity=".75"/>
    <path d="M0 302c118-43 177 66 315 22 121-39 193-8 290 13 141 31 260-50 355-15v68H0Z" fill="#dee8ff" opacity=".45"/>
    <path d="M0 329c122-34 210 62 370 27 138-31 201-2 310 8 127 12 197-28 280-15v41H0Z" fill="url(#avenli-wave)"/>
  </svg>;
}
