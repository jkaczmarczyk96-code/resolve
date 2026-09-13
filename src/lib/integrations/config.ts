import "server-only";
import { z } from "zod";

const schema = z.object({
  clientId: z.string().min(20).endsWith(".apps.googleusercontent.com"),
  clientSecret: z.string().min(16),
  encryptionKey: z.string().min(40),
});

export function googleIntegrationsEnabled() {
  return process.env.GOOGLE_INTEGRATIONS_ENABLED === "true";
}

export function getGoogleIntegrationConfig() {
  const parsed = schema.safeParse({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY,
  });
  if (!parsed.success) throw new Error("Google integrations are not configured.");
  return parsed.data;
}
