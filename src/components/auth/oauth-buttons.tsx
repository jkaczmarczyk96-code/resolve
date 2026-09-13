import { Button } from "@/components/ui/button";
import { enabledOAuthProviders } from "@/lib/auth/oauth";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.55l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z" />
    </svg>
  );
}

export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const providers = enabledOAuthProviders();
  if (!providers.length) return null;
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
        {providers.map((provider) => (
          <form key={provider} action="/auth/oauth" method="post">
            <input type="hidden" name="next" defaultValue={next} />
            <Button type="submit" name="provider" value={provider} variant="outline" className="h-11 w-full border-slate-300 bg-white text-foreground shadow-sm hover:border-primary/40 hover:bg-white hover:shadow-md">
              {provider === "google" && <GoogleLogo />}
              Continue with {provider === "google" ? "Google" : "Apple"}
            </Button>
          </form>
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
