import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mock }) }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://avenli.example" }));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/auth/oauth", () => ({ enabledOAuthProviders: () => ["google"] }));
import { POST } from "@/app/auth/oauth/route";
function request(provider = "google", origin = "https://avenli.example") { return new Request("https://avenli.example/auth/oauth", { method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ provider, next: "//evil.example" }) }); }
beforeEach(() => { vi.clearAllMocks(); });
it("rejects foreign-origin starts and unavailable providers", async () => {
  expect((await POST(request("google", "https://evil.example"))).status).toBe(403);
  expect((await POST(request("apple"))).headers.get("location")).toContain("oauth-unavailable");
  expect(mock.signInWithOAuth).not.toHaveBeenCalled();
});
it("starts only the configured provider with a safe callback", async () => {
  mock.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  expect((await POST(request())).headers.get("location")).toContain("https://test.supabase.co/auth/v1/authorize");
  expect(mock.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://avenli.example/auth/callback?next=%2Fdashboard", skipBrowserRedirect: true } });
});
