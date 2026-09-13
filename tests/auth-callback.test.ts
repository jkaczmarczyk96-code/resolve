import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), storeToken: vi.fn(), clearToken: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: mock.verifyOtp, exchangeCodeForSession: mock.exchangeCodeForSession } }) }));
vi.mock("@/lib/config/server-env", () => ({ getSiteOrigin: () => "https://resolve.example" }));
vi.mock("@/lib/auth/recovery", () => ({ storeRecoveryToken: mock.storeToken, clearRecoveryToken: mock.clearToken }));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => { vi.resetAllMocks(); });

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
