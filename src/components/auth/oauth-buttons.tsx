import { Button } from "@/components/ui/button";
import { enabledOAuthProviders } from "@/lib/auth/oauth";
import { GoogleLogo } from "@/components/google-logo";

export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const providers = enabledOAuthProviders();
  if (!providers.length) return null;
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
        {providers.map((provider) => (
          <Button key={provider} asChild variant="outline" className="h-11 w-full border-slate-300 bg-white text-foreground shadow-sm hover:border-primary/40 hover:bg-white hover:shadow-md">
            <a href={`/auth/oauth?${new URLSearchParams({ provider, next }).toString()}`}>
              <GoogleLogo />
              Continue with Google
            </a>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or continue with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
