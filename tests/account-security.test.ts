import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signOut: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace/http", () => ({ WorkspaceError: class extends Error {} }));
vi.mock("@/lib/supabase/ephemeral", () => ({ createEphemeralClient: () => ({ auth: mock }) }));
import { recentOAuth, verifyPassword } from "@/lib/account/security";
import { passwordChangeSchema, profileSchema } from "@/lib/account/contracts";
beforeEach(() => { vi.clearAllMocks(); });
it("requires a verified password session for the same account", async () => {
  const user = { id: "owner", email: "owner@example.com" };
  mock.signInWithPassword.mockResolvedValue({ data: { user: { id: "other" }, session: {} }, error: null });
  await expect(verifyPassword(user as never, "password")).rejects.toThrow("REAUTH_REQUIRED"); expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  mock.signInWithPassword.mockResolvedValue({ data: { user, session: {} }, error: null }); await expect(verifyPassword(user as never, "password")).resolves.toBeDefined();
});
it("checks the verified session's OAuth authentication time and identity", () => {
  const now = 1_000_000;
  expect(recentOAuth({ sub: "u", amr: [{ method: "oauth", timestamp: 999 }] }, "u", now)).toBe(true);
  for (const claims of [{ sub: "v", amr: [{ method: "oauth", timestamp: 999 }] }, { sub: "u", amr: [{ method: "oauth", timestamp: 699 }] }, { sub: "u", amr: [{ method: "oauth", timestamp: 1001 }] }, { sub: "u", amr: [{ method: "password", timestamp: 999 }] }, {}]) expect(recentOAuth(claims, "u", now)).toBe(false);
});
it("retains password confirmation checks and validates profile URLs/timezones", () => {
  expect(passwordChangeSchema.safeParse({ currentPassword: "old", password: "StrongPassword123", confirmPassword: "different" }).success).toBe(false);
  const profile = { display_name: "Name", avatar_url: "https://example.com/avatar.png", timezone: "Europe/Prague", preferred_language: "cs" };
  expect(profileSchema.safeParse(profile).success).toBe(true);
  expect(profileSchema.safeParse({ ...profile, avatar_url: "javascript:alert(1)" }).success).toBe(false);
  expect(profileSchema.safeParse({ ...profile, timezone: "bad/timezone" }).success).toBe(false);
});
