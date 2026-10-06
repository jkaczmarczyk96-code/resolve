import { enabledOAuthProviders } from "@/lib/auth/oauth";
import { OAuthButtonContent } from "./oauth-button-content";

export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
  const providers = enabledOAuthProviders();
  return providers.length ? <OAuthButtonContent providers={providers} next={next} /> : null;
}
