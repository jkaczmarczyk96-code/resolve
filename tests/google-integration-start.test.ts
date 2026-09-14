import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ enabled: vi.fn(), enabledFor: vi.fn(), identity: vi.fn(), signInWithOAuth: vi.fn(), createState: vi.fn(), loadIntegration: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://avenli.example" }));
vi.mock("@/lib/config/public-env", () => ({ getPublicEnvironment: () => ({ url: "https://test.supabase.co" }) }));
vi.mock("@/lib/integrations/config", () => ({ googleIntegrationsEnabled: mock.enabled, googleIntegrationEnabledFor: mock.enabledFor }));
vi.mock("@/lib/workspace/http", () => ({ identity: mock.identity }));
vi.mock("@/lib/integrations/google", () => ({
  GOOGLE_CALENDAR_WRITE_SCOPE:"calendar.events.owned",
  googleScopesForServices: (services: string[],calendarWrite=false) => [...services.map((service) => `${service}.readonly`),...(calendarWrite ? ["calendar.events.owned"] : [])],
  googleServicesForScopes: (scopes: string[]) => scopes.map((scope) => scope.replace(".readonly", "")),
}));
vi.mock("@/lib/integrations/state", () => ({ createGoogleIntegrationState: mock.createState, googleIntegrationStateCookie: "avenli-google-integration" }));

import { GET } from "@/app/auth/integrations/google/route";

const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: mock.loadIntegration };

beforeEach(() => {
  vi.resetAllMocks(); mock.enabled.mockReturnValue(true); mock.enabledFor.mockReturnValue(true); mock.createState.mockReturnValue("signed-state");
  mock.loadIntegration.mockResolvedValue({ data: null, error: null });
  mock.identity.mockResolvedValue({ user: { id: "owner-id", email: "owner@example.com" }, client: { auth: { signInWithOAuth: mock.signInWithOAuth }, from: vi.fn(() => query) } });
  mock.signInWithOAuth.mockResolvedValue({ data: { url: "https://test.supabase.co/auth/v1/authorize?provider=google" }, error: null });
});

it("starts a read-only Google connection from a same-origin navigation", async () => {
  const response = await GET(new Request("https://avenli.example/auth/integrations/google?service=calendar", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(response.status).toBe(303);
  expect(mock.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: {
    scopes: "calendar.readonly",
    redirectTo: "https://avenli.example/auth/callback?integration=google",
    queryParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    skipBrowserRedirect: true,
  } });
  expect(response.headers.get("set-cookie")).toContain("avenli-google-integration=signed-state");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(mock.createState).toHaveBeenCalledWith("owner-id",{ authorized:["calendar"],enabled:["calendar"],calendarWrite:false,returnTo:"/settings" });
});

it("preserves an enabled Gmail service while adding Calendar authorization", async () => {
  mock.loadIntegration.mockResolvedValue({ data: { status: "connected", scopes: ["gmail.readonly"], enabled_services: ["gmail"] }, error: null });
  await GET(new Request("https://avenli.example/auth/integrations/google?service=calendar", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(mock.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ scopes: "gmail.readonly calendar.readonly" }) }));
  expect(mock.createState).toHaveBeenCalledWith("owner-id",{ authorized:["gmail","calendar"],enabled:["gmail","calendar"],calendarWrite:false,returnTo:"/settings" });
});

it("requests the narrow Calendar event scope only from an in-context write action",async()=>{
  mock.loadIntegration.mockResolvedValue({ data:{ status:"connected",scopes:["calendar.readonly"],enabled_services:["calendar"] },error:null });
  await GET(new Request("https://avenli.example/auth/integrations/google?service=calendar&access=write&next=%2Fproblems%2Fde305d54-75b4-431b-adb2-eb6b9e546014%3Fview%3Dtasks",{ headers:{ Referer:"https://avenli.example/problems/de305d54-75b4-431b-adb2-eb6b9e546014?view=tasks" } }));
  expect(mock.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options:expect.objectContaining({ scopes:"calendar.readonly calendar.events.owned" }) }));
  expect(mock.createState).toHaveBeenCalledWith("owner-id",{ authorized:["calendar"],enabled:["calendar"],calendarWrite:true,returnTo:"/problems/de305d54-75b4-431b-adb2-eb6b9e546014?view=tasks" });
});

it("rejects foreign navigation and keeps disabled integrations dormant", async () => {
  expect((await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://evil.example/" } }))).status).toBe(403);
  mock.enabled.mockReturnValue(false);
  const response = await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(response.headers.get("location")).toBe("https://avenli.example/settings?integration=unavailable");
  expect(mock.identity).not.toHaveBeenCalled();
});

it("keeps the integration unavailable to accounts outside the tester list", async () => {
  mock.enabledFor.mockReturnValue(false);
  const response = await GET(new Request("https://avenli.example/auth/integrations/google", { headers: { Referer: "https://avenli.example/settings" } }));
  expect(response.headers.get("location")).toBe("https://avenli.example/settings?integration=unavailable");
  expect(mock.signInWithOAuth).not.toHaveBeenCalled();
});
