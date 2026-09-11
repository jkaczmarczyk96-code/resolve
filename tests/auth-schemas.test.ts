import { describe, expect, it } from "vitest";
import { emailSchema, registrationSchema, resetPasswordSchema, recoveryTokenSchema } from "@/lib/auth/schemas";
import { isPrivatePath, safeReturnTo } from "@/lib/auth/routes";

describe("safe navigation", () => {
  it.each(["https://attacker.invalid", "//attacker.invalid", "/\\attacker.invalid", "/problems\\evil", "/problems/%2f%2fattacker.invalid", "/problems/../../login", "/problems/%0aevil", "/login", "/dashboard-evil", " /dashboard", "\n/dashboard", null, ["/settings"]])("rejects an unsafe return URL: %s", (url) => {
    expect(safeReturnTo(url)).toBe("/dashboard");
  });
  it("preserves a private deep link and query, without the fragment", () => {
    expect(safeReturnTo("/problems/123?view=plan#tasks")).toBe("/problems/123?view=plan");
  });
  it("protects nested routes without matching similar public names", () => {
    expect(isPrivatePath("/problems/new")).toBe(true);
    expect(isPrivatePath("/settings/security")).toBe(true);
    expect(isPrivatePath("/settings-help")).toBe(false);
  });
});

describe("auth input", () => {
  it("normalizes email", () => { expect(emailSchema.parse("  Person@Example.com ")).toBe("person@example.com"); });
  it.each(["short", "nouppercase1234", "NOLOWERCASE1234", "MissingNumbers", "A1".repeat(70)])("rejects weak or oversized passwords", (password) => {
    expect(resetPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(false);
  });
  it("rejects mismatched passwords on the server", () => {
    expect(registrationSchema.safeParse({ email: "person@example.com", displayName: "Person", password: "MySecurePassword12", confirmPassword: "MySecurePassword13" }).success).toBe(false);
  });
  it("accepts valid registration without a display name", () => {
    expect(registrationSchema.safeParse({ email: "person@example.com", displayName: "", password: "MySecurePassword12", confirmPassword: "MySecurePassword12" }).success).toBe(true);
  });
  it("requires a token-shaped recovery credential", () => {
    expect(recoveryTokenSchema.safeParse("true").success).toBe(false);
    expect(recoveryTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(recoveryTokenSchema.safeParse("pkce_" + "a".repeat(56)).success).toBe(true);
  });
});
