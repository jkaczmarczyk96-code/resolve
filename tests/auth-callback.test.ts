import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), storeToken: vi.fn(), clearToken: vi.fn(), completeGoogleIntegration: vi.fn(), readIntegrationState: vi.fn(), integrationEnabledFor: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: mock.verifyOtp, exchangeCodeForSession: mock.exchangeCodeForSession } }) }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://resolve.example" }));
vi.mock("@/lib/auth/recovery", () => ({ storeRecoveryToken: mock.storeToken, clearRecoveryToken: mock.clearToken }));
vi.mock("@/lib/integrations/google", () => ({ completeGoogleIntegration: mock.completeGoogleIntegration }));
vi.mock("@/lib/integrations/state", () => ({ googleIntegrationStateCookie: "avenli-google-integration", readGoogleIntegrationState: mock.readIntegrationState }));
vi.mock("@/lib/integrations/config", () => ({ googleIntegrationEnabledFor: mock.integrationEnabledFor }));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => { vi.resetAllMocks(); mock.readIntegrationState.mockReturnValue({ authorized: ["calendar"], enabled: ["calendar"],calendarWrite:false,returnTo:"/settings" }); mock.integrationEnabledFor.mockReturnValue(true); });

it("exchanges an OAuth PKCE code and constrains its return URL", async () => {
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u" }, session: {} }, error: null });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&next=//evil.invalid"));
  expect(mock.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code"); expect(response.headers.get("location")).toBe("https://resolve.example/dashboard");
});
it("rejects OAuth code replay or a missing PKCE verifier", async () => {
  mock.exchangeCodeForSession.mockResolvedValue({ data: {}, error: { code: "bad_code_verifier" } });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=used-code"));
  expect(response.headers.get("location")).toBe("https://resolve.example/login?error=oauth-failed");
});
it("completes a requested Google data connection before returning to settings", async () => {
  const user = { id: "u", email: "owner@example.com" }; const session = { provider_token: "access", provider_refresh_token: "refresh" };
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user, session }, error: null });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&integration=google&next=%2Fsettings"));
  expect(mock.completeGoogleIntegration).toHaveBeenCalledWith(expect.anything(), user, session, ["calendar"], ["calendar"],false);
  expect(response.headers.get("location")).toBe("https://resolve.example/settings?integration=connected");
});
it("returns an incremental Calendar write grant to the signed problem path", async () => {
  const user = { id: "u", email: "owner@example.com" }; const session = { provider_token: "access", provider_refresh_token: "refresh" };
  mock.readIntegrationState.mockReturnValue({ authorized: ["calendar"], enabled: ["calendar"], calendarWrite: true, returnTo: "/problems/de305d54-75b4-431b-adb2-eb6b9e546014?view=tasks" });
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user, session }, error: null });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&integration=google"));
  expect(mock.completeGoogleIntegration).toHaveBeenCalledWith(expect.anything(), user, session, ["calendar"], ["calendar"], true);
  expect(response.headers.get("location")).toBe("https://resolve.example/problems/de305d54-75b4-431b-adb2-eb6b9e546014?view=tasks&integration=connected");
});
it("reports a failed Google data connection without exposing provider details", async () => {
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u" }, session: {} }, error: null });
  mock.completeGoogleIntegration.mockRejectedValue(new Error("provider secret"));
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&integration=google"));
  expect(response.headers.get("location")).toBe("https://resolve.example/settings?integration=failed");
  expect(response.headers.get("location")).not.toContain("provider secret");
});
it("rejects a Google data callback without the short-lived account-bound state", async () => {
  mock.readIntegrationState.mockReturnValue(null);
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u" }, session: { provider_token: "access" } }, error: null });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&integration=google"));
  expect(mock.completeGoogleIntegration).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("https://resolve.example/settings?integration=failed");
  expect(response.headers.get("set-cookie")).toContain("avenli-google-integration=");
});
it("returns a cancelled Google data connection to settings and clears its state", async () => {
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?integration=google&error=access_denied"));
  expect(response.headers.get("location")).toBe("https://resolve.example/settings?integration=failed");
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(mock.exchangeCodeForSession).not.toHaveBeenCalled();
});
it("does not complete a Google data connection after the feature is disabled", async () => {
  mock.integrationEnabledFor.mockReturnValue(false);
  mock.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u" }, session: { provider_token: "access" } }, error: null });
  const response = await GET(new NextRequest("https://resolve.example/auth/callback?code=one-time-code&integration=google"));
  expect(response.headers.get("location")).toBe("https://resolve.example/settings?integration=unavailable");
  expect(mock.completeGoogleIntegration).not.toHaveBeenCalled();
});

describe("email callback", () => {
  it("moves recovery proof out of the URL without consuming it on GET", async () => {
    const response = await GET(new NextRequest(`https://resolve.example/auth/callback?type=recovery&token_hash=${"a".repeat(64)}&next=//evil.invalid`));
    expect(response.headers.get("location")).toBe("https://resolve.example/reset-password");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mock.storeToken).toHaveBeenCalledWith("a".repeat(64));
    expect(mock.verifyOtp).not.toHaveBeenCalled();
  });
  it.each(["", "?type=recovery", "?type=magiclink&token_hash=" + "a".repeat(64), "?type=recovery&token_hash=garbage"])("rejects incomplete or unsupported callbacks: %s", async (query) => {
    const response = await GET(new NextRequest(`https://resolve.example/auth/callback${query}`));
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
    expect(mock.verifyOtp).not.toHaveBeenCalled();
    expect(mock.clearToken).toHaveBeenCalled();
  });
  it("confirms email with the auth provider before allowing a private redirect", async () => {
    mock.verifyOtp.mockResolvedValue({ data: { user: { id: "user" }, session: { access_token: "test" } }, error: null });
    const response = await GET(new NextRequest(`https://untrusted-host.invalid/auth/callback?type=signup&token_hash=${"a".repeat(64)}&next=//evil.invalid`));
    expect(response.headers.get("location")).toBe("https://resolve.example/dashboard");
    expect(mock.verifyOtp).toHaveBeenCalledWith({ token_hash: "a".repeat(64), type: "signup" });
  });
  it("fails closed for expired or replayed confirmation links", async () => {
    mock.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "otp_expired" } });
    const response = await GET(new NextRequest(`https://resolve.example/auth/callback?type=signup&token_hash=${"a".repeat(64)}`));
    expect(response.headers.get("location")).toContain("/login?error=invalid-link");
  });
});
