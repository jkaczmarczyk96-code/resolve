import { describe, expect, it } from "vitest";
import { parsePublicEnvironment } from "@/lib/config/public-env";

describe("public configuration", () => {
  it("accepts the local Supabase endpoint", () => {
    expect(parsePublicEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" })).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_test" });
  });
  it.each([
    {},
    { NEXT_PUBLIC_SUPABASE_URL: "not-a-url", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "valid" },
    { NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "valid" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-value" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "replace-with-key" },
  ])("rejects invalid configuration without leaking values", (input) => {
    expect(() => parsePublicEnvironment(input)).toThrow("Supabase configuration is missing or invalid.");
    try { parsePublicEnvironment(input); } catch (error) { expect(String(error)).not.toContain("private-value"); }
  });
});
