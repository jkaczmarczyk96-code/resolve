import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});

export function parsePublicEnvironment(input: Record<string, string | undefined>) {
  const result = publicEnvironmentSchema.safeParse(input);
  if (!result.success) {
    throw new Error("Supabase configuration is missing or invalid. Set the public URL and publishable key from .env.example.");
  }
  return { url: result.data.NEXT_PUBLIC_SUPABASE_URL, publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

export function getPublicEnvironment() {
  // Static property access is required for Next.js public environment replacement.
  return parsePublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
