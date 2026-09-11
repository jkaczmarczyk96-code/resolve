import "server-only";

import { z } from "zod";

const siteUrlSchema = z.url({ protocol: /^https?$/ });

/** Never build emailed links from an untrusted Host or forwarded-host header. */
export function getSiteOrigin() {
  const result = siteUrlSchema.safeParse(process.env.SITE_URL);
  if (!result.success) throw new Error("SITE_URL must be configured for authentication.");
  const url = new URL(result.data);
  if (url.username || url.password || (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("SITE_URL must use HTTPS, except on localhost.");
  }
  return url.origin;
}
