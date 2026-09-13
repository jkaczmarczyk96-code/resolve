import { Button } from "@/components/ui/button";
import { enabledOAuthProviders } from "@/lib/auth/oauth";
export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const providers = enabledOAuthProviders();
  if (!providers.length) return null;
  return <div className="mb-6 space-y-3">{providers.map((provider) => <form key={provider} action="/auth/oauth" method="post"><input type="hidden" name="next" defaultValue={next} /><Button type="submit" name="provider" value={provider} variant="outline" className="w-full">Continue with {provider === "google" ? "Google" : "Apple"}</Button></form>)}</div>;
}
