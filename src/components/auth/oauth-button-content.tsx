"use client";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/google-logo";
import { usePublicCzech } from "@/components/public-language";

export function OAuthButtonContent({ providers, next }: { providers: Array<"google">; next: string }) {
  const cs = usePublicCzech();
  return <div className="space-y-5"><div className="space-y-3 rounded-xl border bg-muted/40 p-3">{providers.map((provider) => <Button key={provider} asChild variant="outline" className="h-11 w-full border-slate-300 bg-white text-foreground shadow-sm hover:border-primary/40 hover:bg-white hover:shadow-md"><a href={`/auth/oauth?${new URLSearchParams({ provider, next }).toString()}`}><GoogleLogo />{cs ? "Pokračovat přes Google" : "Continue with Google"}</a></Button>)}</div><div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>{cs ? "nebo e-mailem" : "or continue with email"}</span><span className="h-px flex-1 bg-border"/></div></div>;
}
