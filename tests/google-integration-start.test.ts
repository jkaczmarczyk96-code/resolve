import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ enabled: vi.fn(), identity: vi.fn(), signInWithOAuth: vi.fn(), createState: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://avenli.example" }));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/integrations/config", () => ({ googleIntegrationsEnabled: mock.enabled }));
vi.mock("@/lib/workspace/http", () => ({ identity: mock.identity }));
vi.mock("@/lib/integrations/google", () => ({ GOOGLE_READ_SCOPES: ["calendar.readonly", "gmail.readonly"] }));
vi.mock("@/lib/integrations/state", () => ({ createGoogleIntegrationState: mock.createState, googleIntegrationStateCookie: "avenli-google-integration" }));

import { GET } from "@/app/auth/integrations/google/route";

beforeEach(() => {
  vi.resetAllMocks(); mock.enabled.mockReturnValue(true); mock.createState.mockReturnValue("signed-state");
  mock.identity.mockResolvedValue({ user: { id: "owner-id" }, client: { auth: { signInWithOAuth: mock.signInWithOAuth } } });
  mock.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
});

it("starts a read-only Google connection from a same-origin navigation", async () => {
  const response = await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(response.status).toBe(303);
  expect(mock.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: {
    scopes: "calendar.readonly gmail.readonly",
    redirectTo: "https://avenli.example/auth/callback?integration=google&next=%2Fsettings",
    queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    skipBrowserRedirect: true,
  } });
  expect(response.headers.get("set-cookie")).toContain("avenli-google-integration=signed-state");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});

it("rejects foreign navigation and keeps disabled integrations dormant", async () => {
  expect((await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://evil.example/" } }))).status).toBe(403);
  mock.enabled.mockReturnValue(false);
  const response = await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(response.headers.get("location")).toBe("https://avenli.example/settings?integration=unavailable");
  expect(mock.identity).not.toHaveBeenCalled();
});
