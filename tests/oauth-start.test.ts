import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mock }) }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://avenli.example" }));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/auth/oauth", () => ({ enabledOAuthProviders: () => ["google"] }));
import { GET, POST } from "@/app/auth/oauth/route";
function request(provider = "google", origin: string | null = "https://avenli.example", referer?: string) {
  const headers = new Headers();
  if (origin) headers.set("Origin", origin);
  if (referer) headers.set("Referer", referer);
  return new Request("https://avenli.example/auth/oauth", { method: "POST", headers, body: new URLSearchParams({ provider, next: "//evil.example" }) });
}
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
it("accepts a same-origin referer when the browser omits Origin", async () => {
  mock.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  expect((await POST(request("google", null, "https://avenli.example/login"))).status).toBe(303);
  expect((await POST(request("google", null, "https://evil.example/login"))).status).toBe(403);
  expect((await POST(request("google", null))).status).toBe(403);
});
it("starts OAuth from a same-origin navigation link", async () => {
  mock.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
  const valid = new Request("https://avenli.example/auth/oauth?provider=google&next=%2Fproblems", { headers: { Referer: "https://avenli.example/login" } });
  const foreign = new Request("https://avenli.example/auth/oauth?provider=google", { headers: { Referer: "https://evil.example/" } });
  expect((await GET(valid)).status).toBe(303);
  expect((await GET(foreign)).status).toBe(403);
  expect(mock.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "https://avenli.example/auth/callback?next=%2Fproblems", skipBrowserRedirect: true } });
});
